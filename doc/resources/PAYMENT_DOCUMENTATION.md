# 💳 Payment Documentation

## 📋 Table of Contents
- [Payment Overview](#payment-overview)
- [Payment Model](#-payment-model)
- [Payment Controller](#-payment-controller)
- [Payment Routes](#-payment-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Payment Overview

Payments in Saveplan-API are primarily used to fulfill member contributions. The system integrates **Daraja (M-Pesa STK Push)** to allow seamless mobile money transactions. Each successful payment updates a corresponding `Contribution` record to `COMPLETED`.

Key flow:
1. Create payment record (status `PENDING`).
2. Initiate STK Push via Daraja.
3. Handle webhook callback from Safaricom.
4. Update payment status to `SUCCESS` or `FAILED`.
5. If `SUCCESS`, update the associated `Contribution` status and link the payment number.

---

## 🗄️ Payment Model

### Schema Definition
```typescript
export interface IPayment extends Document {
  _id: string;
  memberId?: Types.ObjectId | IUser;
  contributionId?: Types.ObjectId | IContribution;
  paymentNumber: string;
  amount: number;
  currency: "KES";
  status: "PENDING" | "SUCCESS" | "FAILED";
  method: "MPESA" | "CASH";
  transactionRef?: string;
  processorRefs?: {
    daraja?: { merchantRequestId?: string; checkoutRequestId?: string };
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `../models/Payment.ts`**

```javascript
import mongoose, { Schema } from 'mongoose';

const paymentSchema = new Schema({
  memberId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User' 
  },
  contributionId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Contribution' 
  },
  paymentNumber: { 
    type: String, 
    required: true, 
    unique: true 
  },
  amount: { 
    type: Number, 
    required: true,
    min: 0
  },
  currency: { 
    type: String, 
    enum: ["KES"], 
    default: "KES" 
  },
  status: { 
    type: String, 
    enum: ["PENDING", "SUCCESS", "FAILED"], 
    default: "PENDING" 
  },
  method: { 
    type: String, 
    enum: ["MPESA", "CASH"], 
    required: true 
  },
  transactionRef: { 
    type: String 
  },
  processorRefs: {
    daraja: {
      merchantRequestId: { type: String },
      checkoutRequestId: { type: String }
    }
  }
}, { timestamps: true });

// Indexing for faster queries
paymentSchema.index({ memberId: 1 });
paymentSchema.index({ contributionId: 1 });
paymentSchema.index({ paymentNumber: 1 }, { unique: true });
paymentSchema.index({ status: 1, createdAt: 1 });
paymentSchema.index({ "processorRefs.daraja.checkoutRequestId": 1 });

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
```

### Validation Rules
```javascript
memberId:       { required: false, ref: 'User' }
contributionId: { required: false, ref: 'Contribution' }
paymentNumber:  { required: true, unique: true }
amount:         { required: true, min: 0 }
currency:       { enum: ["KES"], default: "KES" }
status:         { enum: ["PENDING", "SUCCESS", "FAILED"], default: "PENDING" }
method:         { enum: ["MPESA", "CASH"], required: true }
transactionRef: { type: String, optional: true }
processorRefs:  { type: Object, optional: true }
```

---

## 🎮 Payment Controller

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import Payment from "../models/Payment";
import Contribution from "../models/Contribution";
import User from "../models/User";
import { errorHandler } from "../middleware/errorHandler";
import {
  createPaymentRecord,
  applySuccessfulPayment,
  initiateMpesaPayment
} from "../services/internal/paymentService";
import { parseCallback, queryStkPushStatus } from "../services/external/darajaService";
```

### Functions Overview

#### `initiateContributions()`
**Purpose:** Member initiates a payment for their own contribution.  
**Access:** Authenticated Member.  
**Validation:**
- `amount` and `phone` are required.
- `contributionId` (if provided) must belong to the member and not be `COMPLETED`.
**Process:**
- Validates inputs and contribution ownership.
- Creates a `PENDING` payment record.
- Orchestrates M-Pesa STK Push via `initiateMpesaPayment`.
**Response:** Success message + payment object + gateway metadata.

**Controller Implementation:**
```typescript
export const initiateContributions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { amount, phone, contributionId } = req.body;
    const memberId = req.user?._id;

    if (!amount || !phone) {
      return next(errorHandler(400, "Amount and phone number are required"));
    }

    if (contributionId) {
      const contribution = await Contribution.findById(contributionId);
      if (!contribution) return next(errorHandler(404, "Contribution not found"));
      if (contribution.memberId.toString() !== memberId.toString()) {
        return next(errorHandler(403, "This contribution does not belong to you"));
      }
      if (contribution.status === "COMPLETED") {
        return next(errorHandler(400, "This contribution is already completed"));
      }
    }

    const payment = await createPaymentRecord({
      memberId,
      contributionId,
      amount,
      method: "MPESA"
    });

    const gateway = await initiateMpesaPayment({
      payment,
      phone,
      accountReference: contributionId || `NEW-${memberId.toString().slice(-6)}`
    });

    res.status(200).json({
      success: true,
      message: "Payment initiated",
      data: { payment, gateway }
    });
  } catch (error: any) {
    next(errorHandler(500, `Error initiating payment: ${error.message}`));
  }
};
```

#### `initiateContributionAdmin()`
**Purpose:** Admin/Leader initiates a payment for a specific member.  
**Access:** Chairman, Treasurer.  
**Validation:**
- `memberId`, `amount`, and `phone` are required.
- `memberId` must be a valid user.
**Process:**
- Validates member existence and contribution status.
- Creates a `PENDING` payment record.
- Triggers M-Pesa STK Push for the targeted member.
**Response:** Success message + payment object + gateway metadata.

**Controller Implementation:**
```typescript
export const initiateContributionAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { memberId, amount, phone, contributionId } = req.body;

    if (!memberId || !amount || !phone) {
      return next(errorHandler(400, "memberId, amount, and phone are required"));
    }

    const member = await User.findById(memberId);
    if (!member) return next(errorHandler(404, "Member not found"));

    if (contributionId) {
      const contribution = await Contribution.findById(contributionId);
      if (!contribution) return next(errorHandler(404, "Contribution not found"));
      if (contribution.status === "COMPLETED") {
        return next(errorHandler(400, "This contribution is already completed"));
      }
    }

    const payment = await createPaymentRecord({
      memberId,
      contributionId,
      amount,
      method: "MPESA"
    });

    const gateway = await initiateMpesaPayment({
      payment,
      phone,
      accountReference: contributionId || `ADM-${memberId.toString().slice(-6)}`
    });

    res.status(200).json({
      success: true,
      message: "Payment initiated by admin",
      data: { payment, gateway }
    });
  } catch (error: any) {
    next(errorHandler(500, `Error initiating admin payment: ${error.message}`));
  }
};
```

#### `mpesaWebhook()`
**Purpose:** Handle M-Pesa (Daraja) callback.  
**Access:** Public (Daraja signature verification recommended).  
**Process:**
- Parses Daraja payload.
- Finds corresponding payment by `checkoutRequestId`.
- If successful, updates status to `SUCCESS` and completes the associated contribution.
- If failed, updates status to `FAILED`.
- Emits real-time updates via Socket.io.
**Response:** Always 200 OK (with success boolean).

**Controller Implementation:**
```typescript
export const mpesaWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.body;
    const io = req.app.get("io");

    console.log('===== M-PESA WEBHOOK RECEIVED =====');
    const parsed = parseCallback(payload);
    
    if (!parsed.valid || !parsed.checkoutRequestId) {
      res.status(200).json({ success: false });
      return;
    }

    const payment = await Payment.findOne({ "processorRefs.daraja.checkoutRequestId": parsed.checkoutRequestId });
    if (!payment) {
      res.status(200).json({ success: false });
      return;
    }

    if (!parsed.success) {
      payment.status = "FAILED";
      await payment.save();
      if (io) io.emit("payment.updated", { paymentId: payment._id, status: "FAILED" });
      res.status(200).json({ success: true });
      return;
    }

    payment.transactionRef = parsed.transactionRef;
    await applySuccessfulPayment(payment, io);
    
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('M-Pesa Webhook Error:', error);
    res.status(200).json({ success: false });
  }
};
```

#### `checkPaymentStatus()`
**Purpose:** Manually check STK Push status via Daraja API and sync local records.  
**Access:** Authenticated Member/Admin.  
**Validation:** `checkoutRequestId` in URL parameters.  
**Process:**
- Queries Daraja API for the latest transaction status.
- Proactively updates local database based on the result.
**Response:** Current payment status + raw gateway result.

**Controller Implementation:**
```typescript
export const checkPaymentStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { checkoutRequestId } = req.params;
    
    if (!checkoutRequestId || typeof checkoutRequestId !== "string") {
      return next(errorHandler(400, "checkoutRequestId is required"));
    }

    const payment = await Payment.findOne({ "processorRefs.daraja.checkoutRequestId": checkoutRequestId });
    if (!payment) return next(errorHandler(404, "Payment record not found"));

    const statusResult = await queryStkPushStatus(checkoutRequestId as string);

    if (statusResult.ok) {
      const io = req.app.get("io");
      const resultCode = String(statusResult.resultCode);
      
      if (resultCode === "0") {
        if (payment.status !== "SUCCESS") {
          await applySuccessfulPayment(payment, io);
        }
      } else if (payment.status === "PENDING") {
        payment.status = "FAILED";
        await payment.save();
        if (io) io.emit("payment.updated", { paymentId: payment._id, status: "FAILED" });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        payment,
        status: statusResult
      }
    });
  } catch (error: any) {
    next(errorHandler(500, `Error checking payment status: ${error.message}`));
  }
};
```

#### `getPayments()`
**Purpose:** List all payments with filtering and pagination.  
**Access:** Chairman, Treasurer, Secretary.  
**Process:** Fetches all payments, populating member and contribution details.  
**Response:** Paginated list of payments.

**Controller Implementation:**
```typescript
export const getPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const { status, method } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (method) query.method = method;

    const total = await Payment.countDocuments(query);
    const payments = await Payment.find(query)
      .populate("memberId", "name email phone")
      .populate("contributionId")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, `Error fetching payments: ${error.message}`));
  }
};
```

#### `getMemberPayments()`
**Purpose:** List payments for the logged-in member.  
**Access:** Authenticated Member.

**Controller Implementation:**
```typescript
export const getMemberPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const memberId = req.user?._id;

    const query: any = { memberId };

    const total = await Payment.countDocuments(query);
    const payments = await Payment.find(query)
      .populate("contributionId")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, `Error fetching your payments: ${error.message}`));
  }
};
```

#### `getPayment()`
**Purpose:** Fetch details of a specific payment.  
**Access:** Owner or Admin/Leader.

**Controller Implementation:**
```typescript
export const getPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate("memberId", "name email phone")
      .populate("contributionId");

    if (!payment) return next(errorHandler(404, "Payment not found"));

    // Access control
    const isOwner = payment.memberId?._id?.toString() === req.user?._id.toString();
    const isLeader = ["chairman", "treasurer", "secretary"].some(role => req.roles?.includes(role));

    if (!isOwner && !isLeader) {
      return next(errorHandler(403, "Access denied"));
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error: any) {
    next(errorHandler(500, `Error fetching payment: ${error.message}`));
  }
};
```

#### `deletePayment()`
**Purpose:** Delete a pending or failed payment record.  
**Access:** Owner or Admin.  
**Constraint:** `SUCCESS` payments cannot be deleted.

**Controller Implementation:**
```typescript
export const deletePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return next(errorHandler(404, "Payment not found"));

    if (payment.status === "SUCCESS") {
      return next(errorHandler(400, "Cannot delete a successful payment"));
    }

    // Access control
    const isOwner = payment.memberId?.toString() === req.user?._id.toString();
    const isLeader = ["chairman", "treasurer", "secretary"].some(role => req.roles?.includes(role));

    if (!isOwner && !isLeader) {
      return next(errorHandler(403, "Access denied"));
    }

    await Payment.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Payment record deleted successfully"
    });
  } catch (error: any) {
    next(errorHandler(500, `Error deleting payment: ${error.message}`));
  }
};
```

---

## 🛣️ Payment Routes

### Base Path: `/api/payments`

```typescript
POST   /initiate                       // Member initiates payment
POST   /initiate-admin                 // Admin initiates payment
POST   /webhooks/mpesa                 // Daraja callback (Public)
GET    /status/:checkoutRequestId      // Check M-Pesa status manually
GET    /my-payments                    // List my payments
GET    /                               // List all payments (Admin)
GET    /:id                            // Get payment details
DELETE /:id                            // Delete payment record
```

### Router Implementation

**File: `src/routes/paymentRoutes.ts`**

```typescript
import express from "express";
import {
  initiateContributions,
  initiateContributionAdmin,
  mpesaWebhook,
  checkPaymentStatus,
  getPayments,
  getMemberPayments,
  getPayment,
  deletePayment
} from "../controllers/paymentController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = express.Router();

router.post("/initiate", authenticateToken, initiateContributions);
router.post("/initiate-admin", authenticateToken, authorizeRoles(["chairman", "treasurer"]), initiateContributionAdmin);
router.post("/webhooks/mpesa", mpesaWebhook);
router.get("/status/:checkoutRequestId", authenticateToken, checkPaymentStatus);
router.get("/my-payments", authenticateToken, getMemberPayments);
router.get("/", authenticateToken, authorizeRoles(["chairman", "treasurer", "secretary"]), getPayments);
router.get("/:id", authenticateToken, getPayment);
router.delete("/:id", authenticateToken, deletePayment);

export default router;
```

### Route Details

#### `POST /api/payments/initiate`
**Description:** Member initiates a payment for their own contribution.  
**Access:** Authenticated Member.  
**Body:**
```json
{
  "amount": 1000,
  "phone": "254712345678",
  "contributionId": "65f1a..."
}
```
**Response:**
```json
{
  "success": true,
  "message": "Payment initiated",
  "data": {
    "payment": {
      "_id": "65f1b...",
      "paymentNumber": "PAY-2026-0001",
      "amount": 1000,
      "status": "PENDING"
    },
    "gateway": {
      "merchantRequestId": "...",
      "checkoutRequestId": "..."
    }
  }
}
```

#### `POST /api/payments/initiate-admin`
**Description:** Admin initiates a payment for a specific member.  
**Access:** Chairman, Treasurer.  
**Body:**
```json
{
  "memberId": "65f19...",
  "amount": 1000,
  "phone": "254712345678",
  "contributionId": "65f1a..."
}
```
**Response:**
```json
{
  "success": true,
  "message": "Payment initiated by admin",
  "data": {
    "payment": {
      "_id": "65f1b...",
      "paymentNumber": "PAY-2026-0001",
      "amount": 1000,
      "status": "PENDING"
    },
    "gateway": {
      "merchantRequestId": "...",
      "checkoutRequestId": "..."
    }
  }
}
```

#### `POST /api/payments/webhooks/mpesa`
**Description:** Handle M-Pesa (Daraja) callback from Safaricom.  
**Access:** Public (Daraja).  
**Body:** M-Pesa STK Push callback payload.  
**Response:**
```json
{ "success": true }
```

#### `GET /api/payments/status/:checkoutRequestId`
**Description:** Check M-Pesa STK Push status manually via Daraja API.  
**Access:** Authenticated User.  
**Response:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "_id": "65f1b...",
      "status": "SUCCESS"
    },
    "status": {
      "ok": true,
      "resultCode": "0",
      "resultDesc": "Success"
    }
  }
}
```

#### `GET /api/payments/my-payments`
**Description:** List payments for the currently authenticated member.  
**Access:** Authenticated Member.  
**Query Parameters:** `page`, `limit`.  
**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [...],
    "pagination": { "total": 5, "page": 1, "limit": 10, "pages": 1 }
  }
}
```

#### `GET /api/payments/`
**Description:** List all payments across the system for administrative oversight.  
**Access:** Chairman, Treasurer, Secretary.  
**Query Parameters:** `page`, `limit`, `status`, `method`.  
**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [...],
    "pagination": { "total": 100, "page": 1, "limit": 10, "pages": 10 }
  }
}
```

#### `GET /api/payments/:id`
**Description:** Fetch full details of a specific payment record.  
**Access:** Owner or Admin/Leader.  
**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "65f1b...",
    "paymentNumber": "PAY-2026-0001",
    "amount": 1000,
    "status": "SUCCESS",
    "memberId": { "name": "Jane Doe", ... },
    "contributionId": { "contributionNumber": "CON-A1B2C3", ... }
  }
}
```

#### `DELETE /api/payments/:id`
**Description:** Delete a pending or failed payment record.  
**Access:** Owner or Admin/Leader.  
**Constraint:** `SUCCESS` records cannot be deleted.  
**Response:**
```json
{
  "success": true,
  "message": "Payment record deleted successfully"
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
router.get("/", authorizeRoles(["chairman", "treasurer", "secretary"]), getPayments);
```

#### `checkMemberStatus`
**Purpose:** Ensures the member is both `isVerified` (OTP) and `isActive` before accessing sensitive features.  
**Usage:**
```typescript
router.post("/initiate", authenticateToken, checkMemberStatus, initiateContributions);
```

---

## 📝 API Examples

### Initiate Payment (M-Pesa)
```bash
curl -X POST http://localhost:2500/api/payments/initiate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "phone": "254712345678",
    "contributionId": "64f123..."
  }'
```

### Check Payment Status
```bash
curl -X GET http://localhost:2500/api/payments/status/ws_CO_01022024... \
  -H "Authorization: Bearer <token>"
```

---

## 🛡️ Security Features

- **RBAC:** Strictly enforced roles for admin-only endpoints.
- **Ownership Check:** Members can only view/delete their own pending payments.
- **Webhook Verification:** Logic to ensure only valid Safaricom callbacks update sensitive data.

---

## 📊 Database Indexes

```typescript
paymentSchema.index({ memberId: 1 });
paymentSchema.index({ contributionId: 1 });
paymentSchema.index({ status: 1, createdAt: 1 });
paymentSchema.index({ "processorRefs.daraja.checkoutRequestId": 1 });
```

---

**Last Updated:** April 2026  
**Version:** 1.0.0
