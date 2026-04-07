# 💰 Saveplan API - Contribution System Documentation

## 📋 Table of Contents
- [Contribution Overview](#contribution-overview)
- [Contribution Model](#-contribution-model)
- [Contribution Controller](#-contribution-controller)
- [Contribution Routes](#-contribution-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security & Access Control](#-security--access-control)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## 🔑 Contribution Overview

The Contribution system allows family members to record their financial contributions to the family program. Each contribution starts in a `PENDING` status and can be tracked via a unique `contributionNumber`.

### Contribution Flow
1. **Initiation** → A member creates a contribution record with a specified amount.
2. **Pending** → The record is created with a unique identifier (e.g., `CON-A1B2C3`).
3. **Fulfillment** → (Planned) Integration with payment gateways (M-Pesa) will update the status to `COMPLETED` and record the `transactionDate` and `paymentId`.
4. **Tracking** → Members can view their own history, while leaders have oversight of all records.

---

## 🗄️ Contribution Model

### Schema Definition
```typescript
export interface IContribution extends Document {
  _id: string;
  memberId: Types.ObjectId | IUser;
  contributionNumber: string;
  amount: number;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  paymentId?: string;
  transactionDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `../models/Contribution.ts`**

```javascript
import mongoose, { Schema } from 'mongoose';

const contributionSchema = new Schema({
  memberId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  contributionNumber: { 
    type: String, 
    required: true, 
    unique: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ["PENDING", "COMPLETED", "CANCELLED"], 
    default: "PENDING" 
  },
  paymentId: { 
    type: String 
  },
  transactionDate: { 
    type: Date 
  },
  notes: { 
    type: String 
  }
}, { timestamps: true });

// Indexing for faster queries
contributionSchema.index({ memberId: 1 });
contributionSchema.index({ status: 1 });

const Contribution = mongoose.model('Contribution', contributionSchema);
export default Contribution;
```

### Validation Rules
```javascript
memberId:           { required: true, ref: 'User' }
contributionNumber: { required: true, unique: true }
amount:             { required: true, type: Number }
status:             { enum: ["PENDING", "COMPLETED", "CANCELLED"], default: "PENDING" }
paymentId:          { type: String, optional: true }
transactionDate:    { type: Date, optional: true }
notes:              { type: String, optional: true }
```

---

## 🎮 Contribution Controller

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import Contribution from "../models/Contribution";
import { errorHandler } from "../middleware/errorHandler";
```

### Functions Overview

#### `createContribution(amount, notes)`
**Purpose:** Create a new pending contribution record  
**Access:** Authenticated Users  
**Validation:**
- `amount` is required
**Process:**
- Generates a unique `contributionNumber` (e.g., `CON-A1B2C3`)
- Saves the record with `status: PENDING`
- Defaults `memberId` to the currently authenticated user if not provided
**Response:** Success message + created contribution object

**Controller Implementation:**
```typescript
export const createContribution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { amount, notes, memberId } = req.body;

    if (!amount) {
      return next(errorHandler(400, "Amount is required"));
    }

    // Generate a unique contribution number: CON-XXXXXX
    let contributionNumber = "";
    let isUnique = false;
    
    while (!isUnique) {
      contributionNumber = `CON-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const existing = await Contribution.findOne({ contributionNumber });
      if (!existing) isUnique = true;
    }

    const contribution = new Contribution({
      memberId: memberId || req.user?._id, // Allow setting memberId (for admins) or default to self
      contributionNumber,
      amount,
      notes,
      status: "PENDING"
    });

    await contribution.save();

    res.status(201).json({
      success: true,
      message: "Contribution record created successfully",
      data: contribution
    });
  } catch (error: any) {
    next(errorHandler(500, `Error creating contribution: ${error.message}`));
  }
};
```

#### `getMyContributions(page, limit, status)`
**Purpose:** Fetch a paginated list of contributions for the currently authenticated member  
**Access:** Authenticated Users  
**Validation:** Optional `page`, `limit`, and `status` query parameters  
**Process:**
- Queries contributions where `memberId` matches the current user
- Applies pagination and optional status filtering
**Response:** Paginated list of contributions

**Controller Implementation:**
```typescript
export const getMyContributions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;

    const query: any = { memberId: req.user?._id };

    if (status) {
      query.status = status.toUpperCase();
    }

    const total = await Contribution.countDocuments(query);
    const contributions = await Contribution.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        contributions,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, `Error fetching your contributions: ${error.message}`));
  }
};
```

#### `getContributions(page, limit, status, memberId)`
**Purpose:** Paginated search and list of all contributions for administrative oversight  
**Access:** Chairman / Treasurer / Secretary  
**Validation:** Optional `page`, `limit`, `status`, and `memberId` query parameters  
**Process:**
- Fetches contributions across the entire system
- Populates member details (name, email, phone)
- Applies pagination and filtering
**Response:** Paginated list of all matching contributions

**Controller Implementation:**
```typescript
export const getContributions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const memberId = req.query.memberId as string;

    const query: any = {};

    if (status) {
      query.status = status.toUpperCase();
    }

    if (memberId) {
      query.memberId = memberId;
    }

    const total = await Contribution.countDocuments(query);
    const contributions = await Contribution.find(query)
      .populate("memberId", "name email phone")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        contributions,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, `Error fetching contributions: ${error.message}`));
  }
};
```

#### `getContribution(id)`
**Purpose:** Fetch details of a specific contribution  
**Access:** Owner or Admin/Leader  
**Validation:** `id` must be a valid contribution ID  
**Process:**
- Fetches contribution by ID with populated member details
- Verifies that the requester is either the owner or a leader (Chairman, Treasurer, Secretary)
**Response:** Specific contribution record details

**Controller Implementation:**
```typescript
export const getContribution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const contribution = await Contribution.findById(req.params.id)
      .populate("memberId", "name email phone");

    if (!contribution) {
      return next(errorHandler(404, "Contribution record not found"));
    }

    // Security check: Only the owner or an admin/leader can view details
    const isOwner = req.user?._id.toString() === contribution.memberId._id.toString();
    const isLeader = ["chairman", "treasurer", "secretary"].some(role => req.roles?.includes(role));

    if (!isOwner && !isLeader) {
      return next(errorHandler(403, "Access denied: You cannot view this contribution"));
    }

    res.status(200).json({
      success: true,
      data: contribution
    });
  } catch (error: any) {
    next(errorHandler(500, `Error fetching contribution: ${error.message}`));
  }
};
```

#### `deleteContribution(id)`
**Purpose:** Delete a pending or cancelled contribution  
**Access:** Owner or Admin/Leader  
**Validation:** `id` must be a valid contribution ID  
**Constraint:** `COMPLETED` contributions cannot be deleted.
**Process:**
- Verifies existence and access rights (Owner or Leader)
- Blocks deletion if status is `COMPLETED`
- Deletes the record from the database
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const deleteContribution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const contribution = await Contribution.findById(req.params.id);

    if (!contribution) {
      return next(errorHandler(404, "Contribution record not found"));
    }

    // Security check: Only the owner or an admin/leader can delete
    const isOwner = req.user?._id.toString() === contribution.memberId.toString();
    const isLeader = ["chairman", "treasurer", "secretary"].some(role => req.roles?.includes(role));

    if (!isOwner && !isLeader) {
      return next(errorHandler(403, "Access denied: You cannot delete this contribution"));
    }

    // Only allow deletion of PENDING or CANCELLED contributions
    if (contribution.status === "COMPLETED") {
      return next(errorHandler(400, "Cannot delete a COMPLETED contribution"));
    }

    await Contribution.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Contribution record deleted successfully"
    });
  } catch (error: any) {
    next(errorHandler(500, `Error deleting contribution: ${error.message}`));
  }
};
```

---

## 🛣️ Contribution Routes

### Base Path: `/api/contributions`

```typescript
POST   /                     // Create a new contribution
GET    /                     // List all contributions (Admin oversight)
GET    /my-contributions     // List contributions for current user
GET    /:id                  // Get specific contribution details
DELETE /:id                  // Delete a pending/cancelled contribution
```

### Router Implementation

**File: `src/routes/contributionRoutes.ts`**

```typescript
import express from "express";
import {
  createContribution,
  getContributions,
  getMyContributions,
  getContribution,
  deleteContribution
} from "../controllers/contributionController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.post("/", createContribution);
router.get("/", authorizeRoles(["chairman", "treasurer", "secretary"]), getContributions);
router.get("/my-contributions", getMyContributions);
router.get("/:id", getContribution);
router.delete("/:id", deleteContribution);

export default router;
```

### Route Details

#### `POST /api/contributions`
**Description:** Create a new pending contribution record.  
**Body:**
```json
{
  "amount": 1000,
  "notes": "Monthly contribution for April",
  "memberId": "optional_user_id"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Contribution record created successfully",
  "data": {
    "_id": "65f1a...",
    "memberId": "65f19...",
    "contributionNumber": "CON-A1B2C3",
    "amount": 1000,
    "status": "PENDING",
    "notes": "Monthly contribution for April",
    "createdAt": "2026-04-07T..."
  }
}
```

#### `GET /api/contributions`
**Description:** Administrative oversight to list all contributions across the family program.  
**Access:** Chairman, Treasurer, Secretary.  
**Query Parameters:** `page`, `limit`, `status`, `memberId`.  
**Response:**
```json
{
  "success": true,
  "data": {
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
        "amount": 1000,
        "status": "PENDING",
        "createdAt": "2026-04-07T..."
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 10,
      "pages": 5
    }
  }
}
```

#### `GET /api/contributions/my-contributions`
**Description:** List all contributions made by the currently authenticated user.  
**Query Parameters:** `page`, `limit`, `status`.  
**Response:**
```json
{
  "success": true,
  "data": {
    "contributions": [
      {
        "_id": "65f1a...",
        "contributionNumber": "CON-A1B2C3",
        "amount": 1000,
        "status": "PENDING",
        "createdAt": "2026-04-07T..."
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 10,
      "pages": 1
    }
  }
}
```

#### `GET /api/contributions/:id`
**Description:** Fetch full details of a specific contribution record.  
**Access:** Owner or Leader (Admin).  
**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "65f1a...",
    "memberId": {
      "_id": "65f19...",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "phone": "+254711223344"
    },
    "contributionNumber": "CON-A1B2C3",
    "amount": 1000,
    "status": "PENDING",
    "notes": "Monthly contribution for April",
    "createdAt": "2026-04-07T..."
  }
}
```

#### `DELETE /api/contributions/:id`
**Description:** Delete a contribution record that is either `PENDING` or `CANCELLED`.  
**Access:** Owner or Leader (Admin).  
**Constraint:** `COMPLETED` records cannot be deleted.
**Response:**
```json
{
  "success": true,
  "message": "Contribution record deleted successfully"
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
router.get("/", authorizeRoles(["chairman", "treasurer", "secretary"]), getContributions);
```

#### `checkMemberStatus`
**Purpose:** Ensures the member is both `isVerified` (OTP) and `isActive` before accessing sensitive features.  
**Usage:**
```typescript
router.post("/", authenticateToken, checkMemberStatus, createContribution);
```

---

## 📝 API Examples

### 1. Create a Contribution
```bash
curl -X POST http://localhost:2500/api/contributions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "notes": "Monthly contribution for April"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Contribution record created successfully",
  "data": {
    "_id": "65f1a...",
    "contributionNumber": "CON-A1B2C3",
    "amount": 1000,
    "status": "PENDING"
  }
}
```

### 2. Get My Contributions
```bash
curl -X GET "http://localhost:2500/api/contributions/my-contributions?page=1&limit=5" \
  -H "Authorization: Bearer <token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "contributions": [...],
    "pagination": { "total": 5, "page": 1, "limit": 5, "pages": 1 }
  }
}
```

### 3. Admin Oversight (List All)
```bash
curl -X GET "http://localhost:2500/api/contributions?status=PENDING" \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "contributions": [...],
    "pagination": { "total": 50, "page": 1, "limit": 10, "pages": 5 }
  }
}
```

### 4. Get Specific Contribution
```bash
curl -X GET http://localhost:2500/api/contributions/65f1a... \
  -H "Authorization: Bearer <token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "65f1a...",
    "contributionNumber": "CON-A1B2C3",
    "amount": 1000,
    "status": "PENDING",
    "memberId": { "name": "Jane Doe", ... }
  }
}
```

### 5. Delete Contribution
```bash
curl -X DELETE http://localhost:2500/api/contributions/65f1a... \
  -H "Authorization: Bearer <token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Contribution record deleted successfully"
}
```

---

## 🛡️ Security & Access Control

### Role-Based Access
- **Members**: Can create, view, and delete their own contributions (deletion restricted by status).
- **Leaders (Chairman, Treasurer, Secretary)**: Have full oversight to view all contributions across the system.

### Data Integrity
- **Unique IDs**: Every contribution is assigned a unique `contributionNumber` for tracking.
- **Status Gating**: Records marked as `COMPLETED` are locked from deletion to maintain financial history integrity.

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "Contribution record not found" }
{ "success": false, "message": "Access denied: You cannot view this contribution" }
{ "success": false, "message": "Cannot delete a COMPLETED contribution" }
```

---

## 📊 Database Indexes

```javascript
contributionSchema.index({ memberId: 1 });
contributionSchema.index({ status: 1 });
```

---

**Last Updated:** April 2026  
**Version:** 1.0.0
