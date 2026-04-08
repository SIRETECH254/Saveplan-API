# 📊 Saveplan API - Analytics System Documentation

## 📋 Table of Contents
- [Analytics Overview](#analytics-overview)
- [Time Ranges & Granularity](#time-ranges--granularity)
- [Role-Based Analytics](#role-based-analytics)
- [Analytics Controller](#-analytics-controller)
- [Analytics Routes](#-analytics-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Frontend Integration (React)](#frontend-integration-react)

---

## 📊 Analytics Overview

The Analytics System provides time-series data and comparative growth metrics tailored for different roles within the Saveplan program. It is designed to feed React-based charting libraries (e.g., Recharts, Chart.js, Nivo) with structured, "gap-filled" data.

### Key Features:
- **Dynamic Ranges:** Support for `7d`, `14d`, `28d`, `3m`, `6m`, and `1y`.
- **Growth Comparison:** Automatic calculation of percentage change against the previous equivalent period.
- **Role-Specific Scoping:**
    - **Chairman:** System growth and member participation.
    - **Treasurer:** Financial health, revenue trends, and collection efficiency.
    - **Member:** Personal saving trends and contribution consistency.

---

## ⏳ Time Ranges & Granularity

The system automatically adjusts the data "buckets" based on the requested range to ensure graphs remain readable:

| Range | Mapping | Granularity | Comparison Period |
| :--- | :--- | :--- | :--- |
| **7d** | Last 7 Days | Daily | Days 8-14 ago |
| **14d** | Last 14 Days | Daily | Days 15-28 ago |
| **28d** | Last 28 Days | Daily | Days 29-56 ago |
| **3m** | Last 3 Months | Weekly | Previous 3 months |
| **6m** | Last 6 Months | Monthly | Previous 6 months |
| **1y** | Last 1 Year | Monthly | Previous 1 year |

---

## 🎭 Role-Based Analytics

### 1. Chairman (Governance)
- **Member Growth:** New registrations over time. **Graph: Area/Line Chart.**
- **Participation Rate:** Active members vs. total members. **Graph: Gauge/Doughnut.**
- **System Activity:** Total contributions count. **Graph: Bar Chart.**

### 2. Treasurer (Financials)
- **Revenue Trends:** Total successful payments. **Graph: Multi-Line Chart (Current vs. Previous).**
- **Collection Efficiency:** Pending vs. Completed volume. **Graph: Stacked Bar Chart.**
- **Payment Distribution:** M-Pesa vs. Cash usage. **Graph: Pie Chart.**

### 3. Member (Personal)
- **Savings Progress:** Cumulative total contributed. **Graph: Area Chart.**
- **Consistency Score:** On-time performance. **Graph: Progress Ring.**
- **Contribution History:** Value of individual contributions. **Graph: Bar Chart.**

---

## 🎮 Analytics Controller

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import Contribution from '../models/Contribution';
import Payment from '../models/Payment';
import User from '../models/User';
import { 
  getAnalyticsPeriods, 
  getChartLabels, 
  calculateGrowth, 
  AnalyticsRange
} from '../utils/analyticsHelpers';
import { 
  eachDayOfInterval, 
  eachWeekOfInterval, 
  eachMonthOfInterval, 
  isSameDay, 
  isSameWeek, 
  isSameMonth 
} from 'date-fns';
```

### Functions Overview

#### `getChairmanAnalytics(range)`
**Purpose:** Get system growth and member activity trends  
**Access:** Chairman  
**Features:**
- Member growth (registrations) over time
- Total member count and growth percentage
- System-wide participation activity
**Response:** Growth chart data + summary stats

**Controller Implementation:**
```typescript
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
```

#### `getTreasurerAnalytics(range)`
**Purpose:** Get financial trends and collection efficiency  
**Access:** Treasurer / Chairman  
**Features:**
- Revenue trends (Current vs Previous period)
- Collection efficiency (Completed vs Pending status)
- Payment method distribution (MPESA vs CASH)
**Response:** Revenue comparison chart + efficiency/method breakdowns

**Controller Implementation:**
```typescript
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
```

#### `getMemberAnalytics(range)`
**Purpose:** Get personal contribution and savings progress  
**Access:** Member  
**Features:**
- Personal savings progress over time
- Cumulative total contributed
- Consistency score (Completed vs Total)
**Response:** Personal savings chart + summary consistency score

**Controller Implementation:**
```typescript
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
```

---

## 🛣️ Analytics Routes

### Base Path: `/api/analytics`

```typescript
GET    /chairman       // Chairman oversight trends
GET    /treasurer      // Financial health & cashflow
GET    /member         // Personal contribution progress
```

### Router Implementation

**File: `src/routes/analyticsRoutes.ts`**

```typescript
import express from 'express';
import {
    getChairmanAnalytics,
    getTreasurerAnalytics,
    getMemberAnalytics
} from '../controllers/analyticsController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

router.use(authenticateToken);

router.get('/chairman', authorizeRoles(['chairman']), getChairmanAnalytics);
router.get('/treasurer', authorizeRoles(['treasurer', 'chairman']), getTreasurerAnalytics);
router.get('/member', getMemberAnalytics);

export default router;
```

### Route Details

#### `GET /api/analytics/chairman`
**Description:** Get system growth and member activity trends.  
**Access:** Chairman only.  
**Query Parameters:** `range` (7d, 14d, 28d, 3m, 6m, 1y).  
**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalMembers": 150,
      "newMembers": 12,
      "growthPercent": 8.5,
      "totalContributionsInPeriod": 45
    },
    "chartData": [
      {
        "label": "Apr 01",
        "value": 2
      },
      {
        "label": "Apr 02",
        "value": 3
      }
    ]
  }
}
```

#### `GET /api/analytics/treasurer`
**Description:** Get financial health, revenue trends, and collection efficiency.  
**Access:** Treasurer, Chairman.  
**Query Parameters:** `range` (7d, 14d, 28d, 3m, 6m, 1y).  
**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalRevenue": 150000,
      "revenueGrowth": 12.5,
      "isPositive": true
    },
    "chartData": [
      {
        "label": "Week 1",
        "current": 12000,
        "previous": 10500
      },
      {
        "label": "Week 2",
        "current": 14500,
        "previous": 11000
      }
    ],
    "efficiency": [
      {
        "_id": "COMPLETED",
        "count": 45,
        "totalAmount": 120000
      },
      {
        "_id": "PENDING",
        "count": 12,
        "totalAmount": 30000
      }
    ],
    "methods": [
      {
        "_id": "MPESA",
        "count": 35,
        "totalAmount": 100000
      },
      {
        "_id": "CASH",
        "count": 10,
        "totalAmount": 20000
      }
    ]
  }
}
```

#### `GET /api/analytics/member`
**Description:** Get personal contribution and savings progress.  
**Access:** Authenticated Members.  
**Query Parameters:** `range` (7d, 14d, 28d, 3m, 6m, 1y).  
**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalSaved": 45000,
      "consistencyScore": 92,
      "contributionsInPeriod": 4
    },
    "chartData": [
      {
        "label": "Jan 2026",
        "value": 10000
      },
      {
        "label": "Feb 2026",
        "value": 12000
      }
    ]
  }
}
```

---

## 🛡️ Middleware

### Authentication & Authorization

#### `authenticateToken`
**Purpose:** Verifies JWT and populates `req.user` and `req.roles`.  
**Usage:**
```typescript
router.use(authenticateToken);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Enforces RBAC by checking role names.  
**Example:**
```typescript
router.get("/chairman", authorizeRoles(["chairman"]), getChairmanAnalytics);
```

---

## 📝 API Examples

### 1. Get Chairman Analytics (Member Growth)
```bash
curl -X GET "http://localhost:2500/api/analytics/chairman?range=28d" \
  -H "Authorization: Bearer <chairman_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalMembers": 150,
      "newMembers": 12,
      "growthPercent": 8.5,
      "totalContributionsInPeriod": 45
    },
    "chartData": [
      {
        "label": "Apr 01",
        "value": 2
      },
      {
        "label": "Apr 02",
        "value": 3
      }
    ]
  }
}
```

### 2. Get Treasurer Analytics (Revenue Comparison)
```bash
curl -X GET "http://localhost:2500/api/analytics/treasurer?range=3m" \
  -H "Authorization: Bearer <treasurer_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalRevenue": 150000,
      "revenueGrowth": 25.0,
      "isPositive": true
    },
    "chartData": [
      {
        "label": "Week 1",
        "current": 12000,
        "previous": 10000
      },
      {
        "label": "Week 2",
        "current": 15000,
        "previous": 11000
      }
    ],
    "efficiency": [
      {
        "_id": "COMPLETED",
        "count": 45,
        "totalAmount": 120000
      },
      {
        "_id": "PENDING",
        "count": 12,
        "totalAmount": 30000
      }
    ],
    "methods": [
      {
        "_id": "MPESA",
        "count": 35,
        "totalAmount": 100000
      },
      {
        "_id": "CASH",
        "count": 10,
        "totalAmount": 20000
      }
    ]
  }
}
```

### 3. Get Member Analytics (Savings Progress)
```bash
curl -X GET "http://localhost:2500/api/analytics/member?range=6m" \
  -H "Authorization: Bearer <member_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalSaved": 45000,
      "consistencyScore": 92,
      "contributionsInPeriod": 4
    },
    "chartData": [
      {
        "label": "Jan 2026",
        "value": 10000
      },
      {
        "label": "Feb 2026",
        "value": 12000
      }
    ]
  }
}
```

---

## ⚛️ Frontend Integration (React)

### Recommended Strategy:
1.  **Standardized Props:** The API returns `chartData` as an array of objects. This can be passed directly to Recharts `<LineChart data={data} />`.
2.  **Comparison Lines:** Use two `<Line />` components in React—one for `current` and one for `previous` (often styled with lower opacity).
3.  **Dynamic Titles:** Use the `summary` object to render "Big Number" cards at the top of the page.

---

**Last Updated:** April 2026  
**Version:** 1.0.0  
**Maintainer:** Saveplan API Analytics Team
