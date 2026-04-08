import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Contribution from '../models/Contribution';
import Payment from '../models/Payment';
import User from '../models/User';

/**
 * @desc    Get administrative dashboard statistics for leaders
 * @route   GET /api/dashboard/leader
 * @access  Private (Chairman, Treasurer, Secretary)
 */
export const getLeaderDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Contributions statistics
        const totalContributions = await Contribution.countDocuments();
        const contributionsByStatus = {
            pending: await Contribution.countDocuments({ status: 'PENDING' }),
            completed: await Contribution.countDocuments({ status: 'COMPLETED' }),
            cancelled: await Contribution.countDocuments({ status: 'CANCELLED' })
        };

        // Payments statistics
        const totalPayments = await Payment.countDocuments();
        const paymentsByStatus = {
            pending: await Payment.countDocuments({ status: 'PENDING' }),
            success: await Payment.countDocuments({ status: 'SUCCESS' }),
            failed: await Payment.countDocuments({ status: 'FAILED' })
        };
        const paymentsByMethod = {
            mpesa: await Payment.countDocuments({ method: 'MPESA' }),
            cash: await Payment.countDocuments({ method: 'CASH' })
        };

        // Calculate total revenue from successful payments
        const successfulPayments = await Payment.find({ status: 'SUCCESS' });
        const totalRevenue = successfulPayments.reduce((sum, pay) => sum + pay.amount, 0);

        // Members statistics
        const totalMembers = await User.countDocuments();
        const activeMembers = await User.countDocuments({ isActive: true });
        const verifiedMembers = await User.countDocuments({ isVerified: true });

        // Pending Revenue (from pending contributions)
        const pendingContributions = await Contribution.find({ status: 'PENDING' });
        const pendingRevenue = pendingContributions.reduce((sum, c) => sum + c.amount, 0);

        // Recent activity (last 10 items)
        const recentContributions = await Contribution.find()
            .populate('memberId', 'name email phone')
            .sort({ createdAt: -1 })
            .limit(10);

        const recentPayments = await Payment.find()
            .populate('memberId', 'name email phone')
            .sort({ createdAt: -1 })
            .limit(10);

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    contributions: {
                        total: totalContributions,
                        byStatus: contributionsByStatus
                    },
                    payments: {
                        total: totalPayments,
                        totalAmount: totalRevenue,
                        byStatus: paymentsByStatus,
                        byMethod: paymentsByMethod
                    },
                    members: {
                        total: totalMembers,
                        active: activeMembers,
                        verified: verifiedMembers
                    },
                    financial: {
                        totalRevenue: totalRevenue,
                        pendingRevenue: pendingRevenue
                    }
                },
                recentActivity: {
                    contributions: recentContributions,
                    payments: recentPayments
                }
            }
        });

    } catch (error: any) {
        next(errorHandler(500, "Server error while fetching leader dashboard"));
    }
};

/**
 * @desc    Get member dashboard statistics
 * @route   GET /api/dashboard/member
 * @access  Private (Member)
 */
export const getMemberDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const memberId = req.user?._id;

        if (!memberId) {
            return next(errorHandler(401, "Member authentication required"));
        }

        // Contributions statistics
        const totalContributions = await Contribution.countDocuments({ memberId });
        const contributionsByStatus = {
            pending: await Contribution.countDocuments({ memberId, status: 'PENDING' }),
            completed: await Contribution.countDocuments({ memberId, status: 'COMPLETED' }),
            cancelled: await Contribution.countDocuments({ memberId, status: 'CANCELLED' })
        };

        // Financial summary
        const memberContributions = await Contribution.find({ memberId });
        const totalContributed = memberContributions
            .filter(c => c.status === 'COMPLETED')
            .reduce((sum, c) => sum + c.amount, 0);

        const pendingBalance = memberContributions
            .filter(c => c.status === 'PENDING')
            .reduce((sum, c) => sum + c.amount, 0);

        // Recent activity (last 5 items)
        const recentContributions = await Contribution.find({ memberId })
            .sort({ createdAt: -1 })
            .limit(5);

        const recentPayments = await Payment.find({ memberId })
            .sort({ createdAt: -1 })
            .limit(5);

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    contributions: {
                        total: totalContributions,
                        byStatus: contributionsByStatus
                    },
                    financial: {
                        totalContributed: totalContributed,
                        pendingBalance: pendingBalance
                    }
                },
                recentActivity: {
                    contributions: recentContributions,
                    payments: recentPayments
                }
            }
        });

    } catch (error: any) {
        next(errorHandler(500, "Server error while fetching member dashboard"));
    }
};

/**
 * @desc    Get in-depth financial analytics
 * @route   GET /api/dashboard/financials
 * @access  Private (Chairman, Treasurer)
 */
export const getFinancialStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { period = 'monthly', startDate, endDate } = req.query;

        // Calculate date range
        let start: Date;
        let end: Date = new Date();

        if (startDate && endDate) {
            start = new Date(startDate as string);
            end = new Date(endDate as string);
        } else {
            // Default to last 30 days
            start = new Date();
            start.setDate(start.getDate() - 30);
        }

        // Get successful payments in date range
        const payments = await Payment.find({
            status: 'SUCCESS',
            createdAt: { $gte: start, $lte: end }
        }).populate('memberId', 'name email phone');

        // Calculate total revenue
        const totalRevenue = payments.reduce((sum, pay) => sum + pay.amount, 0);

        // Revenue by payment method
        const revenueByMethod: Record<string, number> = {
            MPESA: 0,
            CASH: 0
        };
        payments.forEach(payment => {
            const method = payment.method;
            if (revenueByMethod[method] !== undefined) {
                revenueByMethod[method] += payment.amount;
            }
        });

        // Top contributing members in this period
        const memberRevenue: Record<string, { member: any, total: number }> = {};
        payments.forEach(pay => {
            const memberId = pay.memberId ? (pay.memberId as any)._id.toString() : 'Unknown';
            if (!memberRevenue[memberId]) {
                memberRevenue[memberId] = {
                    member: pay.memberId,
                    total: 0
                };
            }
            memberRevenue[memberId].total += pay.amount;
        });

        const topContributors = Object.values(memberRevenue)
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);

        res.status(200).json({
            success: true,
            data: {
                period: {
                    start,
                    end,
                    type: period
                },
                revenue: {
                    total: totalRevenue,
                    byMethod: revenueByMethod
                },
                topContributors,
                paymentCount: payments.length
            }
        });

    } catch (error: any) {
        next(errorHandler(500, "Server error while fetching financial statistics"));
    }
};
