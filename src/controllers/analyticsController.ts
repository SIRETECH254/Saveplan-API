import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Contribution from '../models/Contribution';
import Payment from '../models/Payment';
import User from '../models/User';
import { 
  getAnalyticsPeriods, 
  getChartLabels, 
  calculateGrowth, 
  AnalyticsRange,
  getGroupLabel
} from '../utils/analyticsHelpers';
import { startOfDay, endOfDay, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, isSameDay, isSameWeek, isSameMonth } from 'date-fns';

/**
 * @desc    Get Chairman analytics (Member growth & System activity)
 * @route   GET /api/analytics/chairman
 * @access  Private (Chairman)
 */
export const getChairmanAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const range = (req.query.range as AnalyticsRange) || '7d';
    const { current, previous, granularity } = getAnalyticsPeriods(range);

    // 1. Member Growth (Registrations)
    const currentMembers = await User.find({
      createdAt: { $gte: current.start, $lte: current.end }
    }).select('createdAt');

    const previousMembers = await User.find({
      createdAt: { $gte: previous.start, $lte: previous.end }
    }).select('createdAt');

    const totalMembers = await User.countDocuments();
    const growthPercent = calculateGrowth(currentMembers.length, previousMembers.length);

    // Prepare chart data
    const labels = getChartLabels(current, granularity);
    const chartData = labels.map((label, index) => {
      let count = 0;
      currentMembers.forEach(m => {
        if (granularity === 'day') {
          const days = eachDayOfInterval({ start: current.start, end: current.end });
          if (isSameDay(m.createdAt, days[index])) count++;
        } else if (granularity === 'week') {
          const weeks = eachWeekOfInterval({ start: current.start, end: current.end });
          if (isSameWeek(m.createdAt, weeks[index])) count++;
        } else {
          const months = eachMonthOfInterval({ start: current.start, end: current.end });
          if (isSameMonth(m.createdAt, months[index])) count++;
        }
      });
      return { label, value: count };
    });

    // 2. Participation Stats
    const totalContributions = await Contribution.countDocuments({
      createdAt: { $gte: current.start, $lte: current.end }
    });

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalMembers,
          newMembers: currentMembers.length,
          growthPercent,
          totalContributionsInPeriod: totalContributions
        },
        chartData
      }
    });
  } catch (error: any) {
    next(errorHandler(500, `Error fetching chairman analytics: ${error.message}`));
  }
};

/**
 * @desc    Get Treasurer analytics (Financial trends & Collection efficiency)
 * @route   GET /api/analytics/treasurer
 * @access  Private (Treasurer, Chairman)
 */
export const getTreasurerAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const range = (req.query.range as AnalyticsRange) || '7d';
    const { current, previous, granularity } = getAnalyticsPeriods(range);

    // 1. Revenue Trends (Successful Payments)
    const currentPayments = await Payment.find({
      status: 'SUCCESS',
      createdAt: { $gte: current.start, $lte: current.end }
    }).select('amount createdAt');

    const previousPayments = await Payment.find({
      status: 'SUCCESS',
      createdAt: { $gte: previous.start, $lte: previous.end }
    }).select('amount createdAt');

    const currentRevenue = currentPayments.reduce((sum, p) => sum + p.amount, 0);
    const previousRevenue = previousPayments.reduce((sum, p) => sum + p.amount, 0);
    const revenueGrowth = calculateGrowth(currentRevenue, previousRevenue);

    // Chart Data (Current vs Previous)
    const labels = getChartLabels(current, granularity);
    const chartData = labels.map((label, index) => {
      let currentVal = 0;
      let previousVal = 0;

      // Current values
      currentPayments.forEach(p => {
        if (granularity === 'day') {
          const days = eachDayOfInterval({ start: current.start, end: current.end });
          if (isSameDay(p.createdAt, days[index])) currentVal += p.amount;
        } else if (granularity === 'week') {
          const weeks = eachWeekOfInterval({ start: current.start, end: current.end });
          if (isSameWeek(p.createdAt, weeks[index])) currentVal += p.amount;
        } else {
          const months = eachMonthOfInterval({ start: current.start, end: current.end });
          if (isSameMonth(p.createdAt, months[index])) currentVal += p.amount;
        }
      });

      // Previous values (mapped to same labels for comparison)
      previousPayments.forEach(p => {
        if (granularity === 'day') {
          const days = eachDayOfInterval({ start: previous.start, end: previous.end });
          if (isSameDay(p.createdAt, days[index])) previousVal += p.amount;
        } else if (granularity === 'week') {
          const weeks = eachWeekOfInterval({ start: previous.start, end: previous.end });
          if (isSameWeek(p.createdAt, weeks[index])) previousVal += p.amount;
        } else {
          const months = eachMonthOfInterval({ start: previous.start, end: previous.end });
          if (isSameMonth(p.createdAt, months[index])) previousVal += p.amount;
        }
      });

      return { label, current: currentVal, previous: previousVal };
    });

    // 2. Collection Efficiency (Status Breakdown)
    const statusCounts = await Contribution.aggregate([
      { $match: { createdAt: { $gte: current.start, $lte: current.end } } },
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);

    // 3. Payment Method Distribution
    const methodDistribution = await Payment.aggregate([
      { $match: { status: 'SUCCESS', createdAt: { $gte: current.start, $lte: current.end } } },
      { $group: { _id: '$method', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalRevenue: currentRevenue,
          revenueGrowth,
          isPositive: revenueGrowth >= 0
        },
        chartData,
        efficiency: statusCounts,
        methods: methodDistribution
      }
    });
  } catch (error: any) {
    next(errorHandler(500, `Error fetching treasurer analytics: ${error.message}`));
  }
};

/**
 * @desc    Get Member analytics (Personal progress)
 * @route   GET /api/analytics/member
 * @access  Private (Member)
 */
export const getMemberAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const memberId = req.user?._id;
    const range = (req.query.range as AnalyticsRange) || '7d';
    const { current, granularity } = getAnalyticsPeriods(range);

    // 1. Personal Savings Progress
    const myContributions = await Contribution.find({
      memberId,
      status: 'COMPLETED',
      createdAt: { $gte: current.start, $lte: current.end }
    }).select('amount createdAt');

    const totalSaved = await Contribution.aggregate([
        { $match: { memberId, status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Chart Data
    const labels = getChartLabels(current, granularity);
    const chartData = labels.map((label, index) => {
      let amount = 0;
      myContributions.forEach(c => {
        if (granularity === 'day') {
          const days = eachDayOfInterval({ start: current.start, end: current.end });
          if (isSameDay(c.createdAt, days[index])) amount += c.amount;
        } else if (granularity === 'week') {
          const weeks = eachWeekOfInterval({ start: current.start, end: current.end });
          if (isSameWeek(c.createdAt, weeks[index])) amount += c.amount;
        } else {
          const months = eachMonthOfInterval({ start: current.start, end: current.end });
          if (isSameMonth(c.createdAt, months[index])) amount += c.amount;
        }
      });
      return { label, value: amount };
    });

    // 2. Consistency Calculation
    const totalCount = await Contribution.countDocuments({ memberId });
    const completedCount = await Contribution.countDocuments({ memberId, status: 'COMPLETED' });
    const consistencyScore = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalSaved: totalSaved[0]?.total || 0,
          consistencyScore: Math.round(consistencyScore),
          contributionsInPeriod: myContributions.length
        },
        chartData
      }
    });
  } catch (error: any) {
    next(errorHandler(500, `Error fetching member analytics: ${error.message}`));
  }
};
