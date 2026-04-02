# 🎫 Saveplan API - Invitation Code Documentation

## 📋 Table of Contents
- [Invitation Overview](#invitation-overview)
- [Invitation Controller](#invitation-controller)
- [Invitation Routes](#invitation-routes)
- [Security & Access Control](#security--access-control)
- [API Examples](#api-examples)

---

## 🔑 Invitation Overview

The Invitation Code system is the primary gatekeeper for the Saveplan API. It ensures that only authorized individuals can register as family members. 

### Key Features
- **Chairman-Only Generation**: Only users with the `chairman` role (specifically the `can_generate_invite` permission) can create new invitation codes.
- **Unique Codes**: Codes are automatically generated as 8-character uppercase alphanumeric strings.
- **Expiration**: Codes have a default lifespan of 7 days but can be customized.
- **Usage Tracking**: Each code tracks who created it, who used it, and when.

---

## 🎮 Invitation Controller

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import InvitationCode from "../models/InvitationCode";
import { errorHandler } from "../middleware/errorHandler";
```

### Implementation Details

#### `generateInvitation(expiresAt?)`
**Purpose:** Generate a new unique invitation code.
**Access:** Chairman only.
**Process:**
- Generates a unique 8-char hex code.
- Ensures uniqueness by checking against the database.
- Sets a default expiry of 7 days if not provided.

**Controller Implementation:**
```typescript
export const generateInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { expiresAt }: { expiresAt?: Date } = req.body;

    let code = "";
    let isUnique = false;
    
    while (!isUnique) {
      code = crypto.randomBytes(4).toString("hex").toUpperCase();
      const existing = await InvitationCode.findOne({ code });
      if (!existing) isUnique = true;
    }

    const invitation = new InvitationCode({
      code,
      createdBy: req.user?._id,
      expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await invitation.save();

    res.status(201).json({
      success: true,
      message: "Invitation code generated successfully",
      data: invitation
    });
  } catch (error: any) {
    next(errorHandler(500, `Error generating invitation: ${error.message}`));
  }
};
```

#### `getInvitations(page, limit, search, isUsed)`
**Purpose:** Fetch all invitation codes with pagination and search.
**Access:** Chairman only.

**Controller Implementation:**
```typescript
export const getInvitations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const isUsed = req.query.isUsed as string;

    const query: any = {};
    if (search) query.code = { $regex: search, $options: "i" };
    if (isUsed !== undefined) query.isUsed = isUsed === "true";

    const total = await InvitationCode.countDocuments(query);
    const invitations = await InvitationCode.find(query)
      .populate("createdBy", "name email")
      .populate("usedBy", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        invitations,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, `Error fetching invitations: ${error.message}`));
  }
};
```

#### `getInvitationById(id)`
**Purpose:** Get details for a single invitation.

**Controller Implementation:**
```typescript
export const getInvitationById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const invitation = await InvitationCode.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("usedBy", "name email");

    if (!invitation) return next(errorHandler(404, "Invitation code not found"));

    res.status(200).json({ success: true, data: invitation });
  } catch (error: any) {
    next(errorHandler(500, `Error fetching invitation: ${error.message}`));
  }
};
```

#### `updateInvitation(id, data)`
**Purpose:** Update expiry or status of a code.

**Controller Implementation:**
```typescript
export const updateInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { expiresAt, isUsed } = req.body;
    const invitation = await InvitationCode.findById(req.params.id);

    if (!invitation) return next(errorHandler(404, "Invitation code not found"));

    if (expiresAt) invitation.expiresAt = expiresAt;
    if (isUsed !== undefined) invitation.isUsed = isUsed;

    await invitation.save();
    res.status(200).json({ success: true, message: "Updated successfully", data: invitation });
  } catch (error: any) {
    next(errorHandler(500, `Error updating invitation: ${error.message}`));
  }
};
```

#### `deleteInvitation(id)`
**Purpose:** Remove an unused invitation.
**Constraint:** Cannot delete used codes.

**Controller Implementation:**
```typescript
export const deleteInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const invitation = await InvitationCode.findById(req.params.id);
    if (!invitation) return next(errorHandler(404, "Invitation code not found"));
    if (invitation.isUsed) return next(errorHandler(400, "Cannot delete used codes"));

    await InvitationCode.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (error: any) {
    next(errorHandler(500, `Error deleting invitation: ${error.message}`));
  }
};
```

---

## 🛣️ Invitation Routes

### Base Path: `/api/invitations`

```typescript
POST   /        // Generate a new code
GET    /        // List codes (with query params)
GET    /:id     // Get specific code details
PATCH  /:id     // Update code metadata
DELETE /:id     // Delete an unused code
```

### Router Implementation

**File: `src/routes/invitationCodeRoutes.ts`**

```typescript
import express from "express";
import {
  generateInvitation,
  getInvitations,
  getInvitationById,
  updateInvitation,
  deleteInvitation
} from "../controllers/invitationCodeController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = express.Router();

// Middleware lock for all routes
router.use(authenticateToken);
router.use(authorizeRoles(["chairman"]));

router.post("/", generateInvitation);
router.get("/", getInvitations);
router.get("/:id", getInvitationById);
router.patch("/:id", updateInvitation);
router.delete("/:id", deleteInvitation);

export default router;
```

### Route Details

#### `POST /api/invitations`
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "expiresAt": "2026-12-31T23:59:59Z"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Invitation code generated successfully",
  "data": {
    "_id": "60d5f9b4f1b2c3d4e5f6a7b8",
    "code": "A1B2C3D4",
    "createdBy": "60d5f9b4f1b2c3d4e5f6a7b7",
    "isUsed": false,
    "expiresAt": "2026-12-31T23:59:59.000Z",
    "createdAt": "2026-04-01T12:00:00.000Z",
    "updatedAt": "2026-04-01T12:00:00.000Z"
  }
}
```

#### `GET /api/invitations`
**Headers:** `Authorization: Bearer <token>`
**Query Params:** `page=1`, `limit=10`, `search=A1B2`, `isUsed=false`
**Response:**
```json
{
  "success": true,
  "data": {
    "invitations": [
      {
        "_id": "...",
        "code": "A1B2C3D4",
        "createdBy": {
          "_id": "...",
          "name": "Chairman Name",
          "email": "chairman@saveplan.com"
        },
        "isUsed": false,
        "expiresAt": "..."
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 10,
      "pages": 3
    }
  }
}
```

#### `GET /api/invitations/:id`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "60d5f9b4f1b2c3d4e5f6a7b8",
    "code": "A1B2C3D4",
    "createdBy": {
      "_id": "...",
      "name": "Chairman Name",
      "email": "chairman@saveplan.com"
    },
    "isUsed": true,
    "usedBy": {
      "_id": "...",
      "name": "Member Name",
      "email": "member@example.com"
    },
    "expiresAt": "..."
  }
}
```

#### `PATCH /api/invitations/:id`
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "expiresAt": "2027-01-01T00:00:00Z",
  "isUsed": true
}
```
**Response:**
```json
{
  "success": true,
  "message": "Updated successfully",
  "data": {
    "_id": "...",
    "code": "A1B2C3D4",
    "expiresAt": "2027-01-01T00:00:00.000Z",
    "isUsed": true
  }
}
```

#### `DELETE /api/invitations/:id`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "message": "Deleted successfully"
}
```

---

## 🛡️ Security & Access Control

### Permission Requirements
All routes in this resource require:
1. **Authentication**: A valid JWT `accessToken`.
2. **Permission**: The `can_generate_invite` permission (standard for the `chairman` role).

### Bootstrap Logic
To solve the "Chicken and Egg" problem:
- **First User**: The very first user to register on a fresh system is allowed to register **without** an invitation code and is automatically granted the `chairman` role.
- **Subsequent Users**: Once at least one user exists, the system locks down, and all further registrations REQUIRE a valid invitation code.

---

## 📝 API Examples

### 1. Generate an Invitation
```bash
curl -X POST http://localhost:2500/api/invitations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "expiresAt": "2026-12-31T23:59:59Z"
  }'
```

### 2. List Invitations with Search
```bash
curl -X GET "http://localhost:2500/api/invitations?search=A1B2&page=1&limit=5" \
  -H "Authorization: Bearer <token>"
```

---

**Last Updated:** April 2026  
**Version:** 1.0.0
