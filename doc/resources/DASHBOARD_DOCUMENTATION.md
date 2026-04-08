# 📊 Saveplan API - Dashboard Analytics Documentation

## 📋 Table of Contents
- [Dashboard Overview](#dashboard-overview)
- [Dashboard Controller](#dashboard-controller)
- [Dashboard Routes](#dashboard-routes)
- [Route Details](#route-details)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Integration with Other Modules](#integration-with-other-modules)
- [Performance Considerations](#performance-considerations)

---

## 📊 Dashboard Overview

The Saveplan API Dashboard Analytics System provides comprehensive financial insights and statistics for both project leaders (Chairman, Treasurer, Secretary) and members. Dashboards aggregate data from contributions, payments, and user modules to provide clear financial overviews.

### Dashboard System Features
- **Leader Dashboard** - System-wide financial and member analytics
- **Member Dashboard** - Personalized contribution and payment statistics
- **Revenue Analytics** - Contribution performance tracking
- **Contribution Statistics** - Detailed breakdown of pending vs completed contributions
- **Member Activity** - Engagement and growth metrics

### Dashboard Types
1. **Leader Dashboard** - Overview for Treasurer, Chairman, and Secretary
2. **Member Dashboard** - Personal contribution summary
3. **Financial Dashboard** - In-depth revenue and payment method analytics
4. **Contribution Dashboard** - Status-based contribution tracking
5. **Member Growth Dashboard** - User registration and activity trends

---

## 🎮 Dashboard Controller

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Contribution from '../models/Contribution';
import Payment from '../models/Payment';
import User from '../models/User';
import Role from '../models/Role';
```

### Functions Overview

#### `getLeaderDashboard()`
**Purpose:** Get administrative dashboard statistics for leaders
**Access:** Chairman, Treasurer, Secretary
**Features:**
- Total contributions by status
- Total payments and successful revenue
- Total members and active users
- Recent financial activity
**Response:** Complete leader dashboard data

**Controller Implementation:**
```typescript
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
            .sort({ createdAt: 'desc' })
            .limit(10);

        const recentPayments = await Payment.find()
            .populate('memberId', 'name email phone')
            .sort({ createdAt: 'desc' })
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
```

#### `getMemberDashboard()`
**Purpose:** Get member dashboard statistics
**Access:** Authenticated members
**Features:**
- Member's contributions by status
- Member's payment history
- Total contributed amount
- Pending contribution balance
**Response:** Complete member dashboard data

**Controller Implementation:**
```typescript
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
            .sort({ createdAt: 'desc' })
            .limit(5);

        const recentPayments = await Payment.find({ memberId })
            .sort({ createdAt: 'desc' })
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
```

#### `getFinancialStats(query)`
**Purpose:** Get in-depth financial analytics
**Access:** Chairman, Treasurer
**Features:**
- Revenue by period (daily, weekly, monthly, yearly)
- Revenue by payment method
- Top contributing members
**Query Parameters:**
- period: daily, weekly, monthly, yearly
- startDate, endDate: Date range
**Response:** Financial analytics data

**Controller Implementation:**
```typescript
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
```

---

## 🛣️ Dashboard Routes

### Base Path: `/api/dashboard`

```typescript
// Leader Routes
GET    /leader                     // Leader dashboard overview
GET    /financials                 // Financial analytics

// Member Routes
GET    /member                     // Member personal dashboard
```

### Router Implementation

**File: `src/routes/dashboardRoutes.ts`**

```typescript
import express from 'express';
import {
    getLeaderDashboard,
    getMemberDashboard,
    getFinancialStats
} from '../controllers/dashboardController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

// Leader Routes
router.get('/leader', authenticateToken, authorizeRoles(['chairman', 'treasurer', 'secretary']), getLeaderDashboard);
router.get('/financials', authenticateToken, authorizeRoles(['chairman', 'treasurer']), getFinancialStats);

// Member Routes
router.get('/member', authenticateToken, getMemberDashboard);

export default router;
```

### Route Details

#### `GET /api/dashboard/leader`
**Description:** Get administrative dashboard statistics for leaders.  
**Access:** Chairman, Treasurer, Secretary.  
**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "contributions": {
        "total": 100,
        "byStatus": {
          "pending": 20,
          "completed": 70,
          "cancelled": 10
        }
      },
      "payments": {
        "total": 120,
        "totalAmount": 500000,
        "byStatus": {
          "pending": 5,
          "success": 110,
          "failed": 5
        },
        "byMethod": {
          "mpesa": 80,
          "cash": 40
        }
      },
      "members": {
        "total": 50,
        "active": 45,
        "verified": 40
      },
      "financial": {
        "totalRevenue": 500000,
        "pendingRevenue": 20000
      }
    },
    "recentActivity": {
      "contributions": [
        {
          "_id": "65f1a...",
          "memberId": {
            "_id": "65f19...",
            "name": "Jane Doe",
            "email": "jane@example.com",
            "phone": "+254711223344"
          },
          "contributionNumber": "CON-A1B2C3",
          "amount": 5000,
          "status": "COMPLETED",
          "createdAt": "2026-04-07T10:00:00.000Z"
        }
      ],
      "payments": [
        {
          "_id": "65f2b...",
          "memberId": {
            "_id": "65f19...",
            "name": "Jane Doe",
            "email": "jane@example.com",
            "phone": "+254711223344"
          },
          "paymentNumber": "PAY-X9Y8Z7",
          "amount": 5000,
          "status": "SUCCESS",
          "method": "MPESA",
          "transactionRef": "RKH827JS92",
          "createdAt": "2026-04-07T10:05:00.000Z"
        }
      ]
    }
  }
}
```

#### `GET /api/dashboard/member`
**Description:** Get personal dashboard statistics for the currently authenticated member.  
**Access:** Authenticated Members.  
**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "contributions": {
        "total": 5,
        "byStatus": {
          "pending": 1,
          "completed": 4,
          "cancelled": 0
        }
      },
      "financial": {
        "totalContributed": 40000,
        "pendingBalance": 5000
      }
    },
    "recentActivity": {
      "contributions": [
        {
          "_id": "65f1a...",
          "memberId": "65f19...",
          "contributionNumber": "CON-A1B2C3",
          "amount": 5000,
          "status": "COMPLETED",
          "createdAt": "2026-04-07T10:00:00.000Z"
        }
      ],
      "payments": [
        {
          "_id": "65f2b...",
          "memberId": "65f19...",
          "paymentNumber": "PAY-X9Y8Z7",
          "amount": 5000,
          "status": "SUCCESS",
          "method": "MPESA",
          "transactionRef": "RKH827JS92",
          "createdAt": "2026-04-07T10:05:00.000Z"
        }
      ]
    }
  }
}
```

#### `GET /api/dashboard/financials`
**Description:** In-depth financial analytics with period-based filtering.  
**Access:** Chairman, Treasurer.  
**Query Parameters:** `period` (daily, weekly, monthly, yearly), `startDate`, `endDate`.  
**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2026-03-08T...",
      "end": "2026-04-08T...",
      "type": "monthly"
    },
    "revenue": {
      "total": 50000,
      "byMethod": {
        "MPESA": 30000,
        "CASH": 20000
      }
    },
    "topContributors": [
      {
        "member": {
          "_id": "65f19...",
          "name": "Jane Doe",
          "email": "jane@example.com",
          "phone": "+254711223344"
        },
        "total": 15000
      }
    ],
    "paymentCount": 25
  }
}
```

---

## 🛡️ Middleware

### Authentication & Authorization

#### `authenticateToken`
**Purpose:** Verifies JWT and populates `req.user` and `req.roles` (extracted from populated roles).  
**Usage:**
```typescript
router.use(authenticateToken);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Enforces RBAC by checking if the user has at least one of the required role names.  
**Example:**
```typescript
router.get("/leader", authorizeRoles(["chairman", "treasurer", "secretary"]), getLeaderDashboard);
```

#### `checkMemberStatus`
**Purpose:** Ensures the member is both `isVerified` (OTP) and `isActive` before accessing sensitive features.  
**Usage:**
```typescript
router.get("/member", authenticateToken, checkMemberStatus, getMemberDashboard);
```

---

## 📝 API Examples

### 1. Get Leader Dashboard Overview
```bash
curl -X GET http://localhost:2500/api/dashboard/leader \
  -H "Authorization: Bearer <leader_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "contributions": {
        "total": 100,
        "byStatus": { "pending": 20, "completed": 70, "cancelled": 10 }
      },
      "payments": {
        "total": 120,
        "totalAmount": 500000,
        "byStatus": { "pending": 5, "success": 110, "failed": 5 },
        "byMethod": { "mpesa": 80, "cash": 40 }
      },
      "members": { "total": 50, "active": 45, "verified": 40 },
      "financial": { "totalRevenue": 500000, "pendingRevenue": 20000 }
    },
    "recentActivity": {
      "contributions": [...],
      "payments": [...]
    }
  }
}
```

### 2. Get Member Dashboard Summary
```bash
curl -X GET http://localhost:2500/api/dashboard/member \
  -H "Authorization: Bearer <member_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "contributions": {
        "total": 5,
        "byStatus": { "pending": 1, "completed": 4, "cancelled": 0 }
      },
      "financial": { "totalContributed": 40000, "pendingBalance": 5000 }
    },
    "recentActivity": {
      "contributions": [...],
      "payments": [...]
    }
  }
}
```

### 3. Get Financial Analytics (Admin)
```bash
curl -X GET "http://localhost:2500/api/dashboard/financials?period=monthly&startDate=2026-03-01&endDate=2026-03-31" \
  -H "Authorization: Bearer <leader_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "period": { "start": "2026-03-01...", "end": "2026-03-31...", "type": "monthly" },
    "revenue": { "total": 50000, "byMethod": { "MPESA": 30000, "CASH": 20000 } },
    "topContributors": [
      {
        "member": {
          "name": "Jane Doe",
          "phone": "+254711223344",
          "email": "jane@example.com"
        },
        "total": 15000
      }
    ],
    "paymentCount": 25
  }
}
```

---

## 🔒 Security Features

### Access Control
- **Leader Only** - System-wide financial data is restricted to leaders.
- **Member Isolation** - Members can only see their own contribution data.
- **Verification Check** - Requires accounts to be active and verified.

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "Member authentication required" }
{ "success": false, "message": "Insufficient permissions: Access denied for your role" }
{ "success": false, "message": "Server error while fetching leader dashboard" }
```

---

## 🔗 Integration with Other Modules

### Contribution Integration
- Contribution statistics and status breakdowns
- Revenue tracking from completed contributions

### Payment Integration
- Payment statistics
- Revenue by payment method
- Payment history

### Member Integration
- Member activity metrics
- Member engagement statistics

---

## 📊 Performance Considerations

### Optimization Tips
- **Database Indexes** - Ensure proper indexes on frequently queried fields
- **Aggregation** - Use MongoDB aggregation for complex calculations

---

**Last Updated:** April 2026  
**Version:** 2.0.0  
**Maintainer:** Saveplan API Development Team
