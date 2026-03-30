# SAVEPLAN API - Backend Documentation

## Table of Contents
- [Technology Stack](#technology-stack)
- [Required Packages](#required-packages)
- [Database Models](#database-models)
- [Controllers](#controllers)
- [Routes](#routes)
- [Architecture Overview](#architecture-overview)

---

## Technology Stack

- Runtime: Node.js
- Framework: Express.js
- Language: TypeScript
- Database: MongoDB (Mongoose ODM)
- Payments: M-Pesa Daraja API (STK Push & B2C)
- SMS/OTP: Africa's Talking
- API Docs: Swagger (swagger-jsdoc, swagger-ui-express)

---

## Required Packages

### Core Dependencies (Targeted)
```json
{
  "africastalking": "^0.7.3",
  "axios": "^1.10.0",
  "bcryptjs": "^3.0.2",
  "cors": "^2.8.5",
  "dotenv": "^17.1.0",
  "express": "^4.18.2",
  "joi": "^18.0.0",
  "mongoose": "^8.16.2",
  "mongoose-paginate-v2": "^1.9.1",
  "nodemailer": "^7.0.5",
  "nodemon": "^3.1.10",
  "pdfkit": "^0.17.1",
  "socket.io": "^4.8.1",
  "swagger-jsdoc": "^6.2.8",
  "swagger-ui-express": "^5.0.1",
  "validator": "^13.15.15"
}
```

---

## Database Models

### 1. User Model
```typescript
interface IUser {
  _id: string;
  name: string;
  email: string;
  phone: string; // Primary M-Pesa Number
  isVerified: boolean; // OTP Verification Status
  lastLoginAt?: Date;
  roles: string[]; // Role ObjectIds (Member, Treasurer, Chairman)
  notificationPreferences?: {
    email: boolean;
    sms: boolean;
    contributionAlerts: boolean;
    payoutUpdates: boolean;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 2. Role Model
```typescript
interface IRole {
  _id: string;
  name: "member" | "treasurer" | "chairman" | "secretary";
  description: string;
  permissions: string[]; // Granular permission strings
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 3. ProgramConfig Model
```typescript
interface IProgramConfig {
  _id: string;
  familyName: string;
  chairmanId: string; // User ID
  treasurerId: string; // User ID
  tillNumber: string; // Business M-Pesa Till
  isContributionActive: boolean; // Controls end-of-year freeze
  payoutLockStatus: {
    treasurerInitiated: boolean;
    chairmanApproved: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 4. Contribution Model
```typescript
interface IContribution {
  _id: string;
  memberId: string; // User ID
  amount: number;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  paymentId?: string; // Reference to Payment Model
  transactionDate: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 5. Payment Model
```typescript
interface IPayment {
  _id: string;
  contributionId?: string; // Reference to Contribution Model
  payoutId?: string; // Reference to Payout Model
  amount: number;
  currency: "KES";
  type: "STK_PUSH" | "B2C";
  status: "INITIATED" | "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";
  processorRefs: {
    merchantRequestId?: string;
    checkoutRequestId?: string;
    mpesaReceiptNumber?: string;
    b2cReference?: string;
  };
  rawPayload?: any; // Callback data
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 6. Payout Model
```typescript
interface IPayout {
  _id: string;
  memberId: string; // User ID
  totalContributed: number;
  payoutAmount: number;
  status: "DRAFT" | "INITIATED" | "APPROVED" | "COMPLETED" | "FAILED";
  initiatedBy: string; // Treasurer User ID
  approvedBy?: string; // Chairman User ID
  paymentId?: string; // Reference to Payment Model
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 7. InvitationCode Model
```typescript
interface IInvitationCode {
  _id: string;
  code: string;
  createdBy: string; // Chairman User ID
  isUsed: boolean;
  usedBy?: string; // User ID
  expiresAt?: Date;
  createdAt: Date;
}
```

---

### 8. Notification Model
```typescript
interface INotification {
  _id: string;
  userId: string; // User ObjectId
  type: "contribution_received" | "payout_initiated" | "payout_approved" | "system_alert";
  payload?: any;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 9. AuditLog Model
```typescript
interface IAuditLog {
  _id: string;
  action: string;
  performedBy: string; // User ID
  resourceId: string;
  oldValues?: any;
  newValues?: any;
  timestamp: Date;
}
```

---

## Controllers

### 1. Auth Controllers
- `register()` - Register with Invitation Code and M-Pesa phone
- `verifyOTP()` - Verify phone ownership via Africa's Talking
- `login()` - Secure login with JWT
- `logout()` - Invalidate session
- `getMe()` - Get current user profile and roles
- `forgotPassword()` - Initiate password recovery
- `resetPassword()` - Update password using token

### 2. Contribution Controllers
- `initiateContribution()` - Create a contribution record and trigger payment
- `getPersonalHistory()` - Member view of their own contributions
- `getAllContributions()` - Treasurer view of all group savings
- `getContributionById()` - Detailed view of a specific entry

### 3. Payment Controllers
- `stkPushCallback()` - Daraja webhook for incoming payments
- `b2cCallback()` - Daraja webhook for outgoing payouts
- `queryPaymentStatus()` - Manual check of M-Pesa transaction status
- `getPaymentDetails()` - View raw processor references

### 4. Dashboard Controllers
- `getMemberDashboard()` - Stats for current member (Personal total, recent activities)
- `getAdminDashboard()` - High-level overview for Chairman/Treasurer (Till balance, total members)

### 5. Analytics Controllers
- `getContributionTrends()` - Monthly/Weekly savings graphs
- `getMemberParticipation()` - Data on active vs. inactive members
- `getSystemMetrics()` - Payout success rates and API health

### 6. Treasurer Controllers
- `getLedger()` - Automated ledger of all verified payments
- `generateReport()` - Export PDF/Excel for family meetings
- `initiateYearEndPayout()` - Start the payout process (Key 1)

### 7. Chairman Controllers
- `generateInvitationCode()` - Create unique codes for new members
- `manageRoles()` - Assign permissions to specific family members
- `approvePayout()` - Final authorization for distribution (Key 2)
- `getMemberOversight()` - Profile management of all family members

### 8. Payout Controllers
- `calculateReconciliation()` - Verify totals before distribution
- `executeB2C()` - Trigger M-Pesa B2C transfers
- `getPayoutLogs()` - Audit history of fund movement

---

## Routes

### 1. Auth Routes
Base: `/api/auth`
```typescript
POST   /register                  // Register with Invitation Code
POST   /verify-otp                // OTP verification
POST   /login                     // User login
POST   /forgot-password           // Recovery email/SMS
POST   /reset-password            // Update password
GET    /me                        // Current profile
```

### 2. Contribution Routes
Base: `/api/contributions`
```typescript
POST   /                          // Start new contribution
GET    /history                   // Personal contribution list
GET    /all                       // All group contributions (Treasurer)
```

### 3. Payment Routes
Base: `/api/payments`
```typescript
POST   /callback/stk              // Daraja STK Webhook
POST   /callback/b2c              // Daraja B2C Webhook
GET    /:id/status                // Query transaction
```

### 4. Dashboard & Analytics
Base: `/api/stats`
```typescript
GET    /dashboard                 // Role-based dashboard data
GET    /analytics/trends          // Savings trends
GET    /analytics/participation   // Participation metrics
```

### 5. Treasurer & Governance
Base: `/api/admin`
```typescript
GET    /ledger                    // All verified transactions
POST   /payout/initiate           // Treasurer starts payout
POST   /payout/approve            // Chairman final sign-off
POST   /invite-codes              // Generate family codes
```

---

## Architecture Overview

### Folder Structure
```
server/
├── models/
│   ├── userModel.ts
│   ├── contributionModel.ts
│   ├── paymentModel.ts
│   ├── payoutModel.ts
│   └── ...
├── controllers/
│   ├── authController.ts
│   ├── contributionController.ts
│   ├── paymentController.ts
│   ├── dashboardController.ts
│   └── ...
├── routes/
│   ├── authRoute.ts
│   ├── contributionRoute.ts
│   ├── adminRoute.ts
│   └── ...
├── middlewares/
│   └── auth.ts                // JWT & Permission Checks
├── services/
│   ├── darajaService.ts       // M-Pesa Integration
│   ├── atService.ts           // SMS/OTP Integration
│   └── reportService.ts       // PDF/Excel Generation
└── index.ts                   // Entry point
```

---

### Middleware
- `authenticateToken` - JWT verification
- `authorizePermissions(['can_approve_payout', 'can_view_ledger'])` - Granular checks
- `checkContributionWindow` - Enforces year-end contribution freeze

---

### Environment Variables
```env
PORT=4500
MONGO_URI=mongodb://localhost:27017/saveplan
JWT_SECRET=...

# M-Pesa Daraja
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_PASSKEY=...
MPESA_SHORTCODE=... (Business Till)

# Africa's Talking
AT_USERNAME=...
AT_API_KEY=...
```

---

### Security Features
1. **Double-Lock Payout**: Requires sequential action from Treasurer and Chairman.
2. **Permission-Based Access**: Roles define granular permissions (no static isAdmin).
3. **Transaction Immutability**: All payment-linked contributions are read-only after success.

---

### Integration Points
1. **M-Pesa Daraja**: Real-time STK push for deposits and B2C for payouts.
2. **Africa's Talking**: OTP for secure registration and transactional SMS.

---

### PDF Generation
- Generate official family ledgers and member contribution certificates.

---

## Getting Started
1. `npm install`
2. Configure `.env` with Daraja and AT credentials.
3. `npm run dev`

---

## API Response Format
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

---

## Status Codes
- 200: Success
- 401: Unauthorized (Invalid credentials)
- 403: Forbidden (Insufficient permissions)
- 422: Unprocessable Entity (Daraja/OTP errors)

---

Last Updated: March 2026
Version: 1.1.0
Note: Updated to include dual Payment/Contribution models and granular permission roles.