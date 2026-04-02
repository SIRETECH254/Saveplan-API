# 🔐 Saveplan API - Authentication and Authorization Middleware Documentation

## 📋 Table of Contents
- [Auth Middleware Overview](#auth-middleware-overview)
- [Implementation Details](#implementation-details)
  - [authenticateToken](#authenticatetoken)
  - [authorizePermissions](#authorizepermissions)
  - [checkMemberStatus](#checkmemberstatus)
  - [requireDoubleLock](#requiredoublelock)
- [Usage in Routes](#usage-in-routes)
  - [Auth Routes](#auth-routes)
  - [Contribution Routes](#contribution-routes)
  - [Payment Routes](#payment-routes)
  - [Admin Routes](#admin-routes)
  - [Stats Routes](#stats-routes)
- [Error Handling](#error-handling)

---

## Auth Middleware Overview

The middleware layer (`src/middleware/auth.ts`) is the primary security gate for the Saveplan API. It handles JWT verification, RBAC permission checks, and enforces specific Saveplan mandates like the Double-Lock for payouts.

---

## Implementation Details

### `authenticateToken`

Verifies the JWT, populates the user document, and maps role permissions into a flat array for easy checking.

**File: `src/middleware/auth.ts` - `authenticateToken` snippet**
```typescript
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import User from "../models/User";
import { errorHandler } from "./errorHandler";

declare global {
  namespace Express {
    interface Request {
      user?: any; // Populated IUser
      permissions?: string[]; // Flat array of permission strings
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return next(errorHandler(401, "Access token required"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const user = await User.findById(decoded.userId).populate("roles");

    if (!user || !user.isActive) return next(errorHandler(401, "User unauthorized or inactive"));

    // Flatten permissions
    const permissions = user.roles.flatMap((role: any) => role.permissions);

    req.user = user;
    req.permissions = [...new Set(permissions)];

    next();
  } catch (err) {
    next(errorHandler(401, "Invalid or expired token"));
  }
};
```

### `authorizePermissions`

Enforces role-based access control by checking if the user's roles contain the required permission string.

**File: `src/middleware/auth.ts` - `authorizePermissions` snippet**
```typescript
export const authorizePermissions = (requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const hasPermission = requiredPermissions.every(p => req.permissions?.includes(p));

    if (!hasPermission) {
      return next(errorHandler(403, "Insufficient permissions for this action"));
    }

    next();
  };
};
```

---

## Usage in Routes

### Auth Routes (`src/routes/authRoutes.ts`)
Used for session management.
```typescript
router.get("/me", authenticateToken, getMe);
router.post("/logout", authenticateToken, logout);
```

### Contribution Routes (`src/routes/contributionRoutes.ts`)
Ensures only verified members can contribute.
```typescript
router.post("/", authenticateToken, checkMemberStatus, initiateContribution);
router.get("/history", authenticateToken, getPersonalHistory);
router.get("/all", authenticateToken, authorizePermissions(["can_view_all_ledgers"]), getAllContributions);
```

### Admin Routes (`src/routes/adminRoute.ts`)
Restricted to Treasurer and Chairman roles.
```typescript
// Treasurer initiates (Key 1)
router.post("/payout/initiate", authenticateToken, authorizePermissions(["can_initiate_payout"]), initiateYearEndPayout);

// Chairman approves (Key 2)
router.post("/payout/approve", authenticateToken, authorizePermissions(["can_approve_payout"]), approvePayout);

// Chairman manages members
router.post("/invite-codes", authenticateToken, authorizePermissions(["can_generate_invite"]), generateInvitationCode);
```

---

## Error Handling

Middleware uses the centralized `errorHandler` to return standardized responses:
- `401 Unauthorized`: Missing/invalid token.
- `403 Forbidden`: Insufficient permissions or inactive account.

---

**Last Updated:** March 2026  
**Version:** 1.1.0  
**Status:** Updated for Saveplan RBAC System
