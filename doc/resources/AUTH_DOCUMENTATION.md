# 🔐 Saveplan API - Authentication System Documentation

## 📋 Table of Contents
- [Authentication Overview](#authentication-overview)
- [Authentication Controller](#authentication-controller)
- [Authentication Routes](#authentication-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)

---

## 🔑 Authentication Overview

The Saveplan API uses JWT (JSON Web Tokens) for authentication with a robust role-based access control (RBAC) system. Registration is restricted via an **Invitation Gate**, requiring a valid invitation code. The system incorporates mandatory OTP verification via Africa's Talking for identity confirmation and security.

### Authentication Flow
1. **Registration** → Requires a valid `InvitationCode`. New users are assigned the `member` role by default.
2. **OTP Verification** → Mandatory verification via SMS/Email to activate the account (`isVerified`).
3. **Login** → Authenticate using Email or Phone + Password.
4. **Token Validation** → Middleware verifies JWT and populates permissions from assigned roles.
5. **Double-Lock Payouts** → Security mechanism requiring dual authorization (Treasurer + Chairman).

### Unified User System
- **Single User Model** - All family members use the same User model.
- **Role-Based Access** - Users have a `roles` array referencing the Role model.
- **Default Role** - New users automatically receive the `member` role.
- **Permission Gating** - Access is controlled via specific permission strings (e.g., `can_approve_payout`) rather than role names.
- **Identity Gate** - Registration requires a valid `InvitationCode` and verified `OTP`.

### User Roles
- `member` - Standard family member (default role).
- `treasurer` - Financial lead (Key 1 of Double-Lock).
- `chairman` - Governance lead (Key 2 of Double-Lock).
- `secretary` - Administrative support.

### Security Features
- **Invitation Gate** - Only invited members can register.
- **OTP Verification** - Mandatory identity verification before account activation.
- **RBAC** - Granular permission-based access control.
- **Password Security** - Bcrypt hashing with 12 salt rounds.
- **Short-lived Tokens** - 15-minute access tokens and 7-day refresh tokens.

---

## 🎮 Authentication Controller

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import validator from "validator";
import crypto from "crypto";
import { errorHandler } from "../middleware/errorHandler";
import User from "../models/User";
import Role from "../models/Role";
import InvitationCode from "../models/InvitationCode";
import { generateTokens, generateOTP } from "../utils/authHelpers";
import {
  sendOTPNotification,
  sendPasswordResetNotification,
  sendWelcomeNotification
} from "../services/internal/notificationService";
```

### Functions Overview

#### `register(userData)`
**Purpose:** Register a new family member with a valid invitation code  
**Access:** Public (requires valid invitation code)  
**Validation:**
- Required fields: `invitationCode`, `name`, `email`, `phone`, `password`
- Invitation code must be valid, unused, and not expired
- Valid email format and unique email/phone
**Process:**
- Validate invitation code
- Hash password and generate 6-digit OTP
- Create user with `member` role and `isVerified: false`
- Mark invitation code as used
- Send OTP notification via SMS/Email
**Response:** User summary + verification status

**Controller Implementation:**
```typescript
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      invitationCode,
      name,
      email,
      phone,
      password
    }: {
      invitationCode: string;
      name: string;
      email: string;
      phone: string;
      password: string;
    } = req.body;

    if (!invitationCode || !name || !email || !phone || !password) {
      return next(errorHandler(400, "All fields are required including invitation code"));
    }

    // Validate Invitation Code
    const codeDoc = await InvitationCode.findOne({
      code: invitationCode.toUpperCase(),
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!codeDoc) {
      return next(errorHandler(400, "Invalid or expired invitation code"));
    }

    if (!validator.isEmail(email)) {
      return next(errorHandler(400, "Please provide a valid email"));
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }]
    });

    if (existingUser) {
      return next(errorHandler(400, "User already exists with this email or phone"));
    }

    const hashedPassword = bcrypt.hashSync(password, 12);
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const memberRole = await Role.findOne({ name: "member" });
    if (!memberRole) {
      return next(errorHandler(500, "Default role 'member' not configured. Please seed roles."));
    }

    const user = new User({
      name,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      roles: [memberRole._id],
      otpCode: otp,
      otpExpiry,
      isVerified: false
    });

    await user.save();

    // Mark invitation code as used
    codeDoc.isUsed = true;
    codeDoc.usedBy = user._id;
    await codeDoc.save();

    // Send OTP via internal notification service (Email/SMS)
    await sendOTPNotification(email, phone, otp, name);

    res.status(201).json({
      success: true,
      message: "Registration successful. Please verify your identity with the OTP sent.",
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isVerified: user.isVerified
      }
    });
  } catch (error: any) {
    next(errorHandler(500, `Server error during registration: ${error.message}`));
  }
};
```

#### `verifyOTP(email/phone, otp)`
**Purpose:** Verify OTP and activate account  
**Access:** Public  
**Validation:**
- OTP is required
- Email or phone is required
- User exists and OTP matches/not expired
**Process:**
- Mark user as verified (`isVerified = true`)
- Clear OTP fields
- Send welcome notification
- Issue access/refresh tokens
**Response:** User data + access/refresh tokens

**Controller Implementation:**
```typescript
export const verifyOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, phone, otp }: { email?: string; phone?: string; otp: string } = req.body;

    if (!otp || (!email && !phone)) {
      return next(errorHandler(400, "OTP and identifier (email or phone) are required"));
    }

    const query = email ? { email: email.toLowerCase() } : { phone };
    const user = await User.findOne(query).select("+otpCode +otpExpiry");

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    if (user.otpExpiry && user.otpExpiry < new Date()) {
      return next(errorHandler(400, "OTP has expired"));
    }

    if (user.otpCode !== otp.trim()) {
      return next(errorHandler(400, "Incorrect OTP code"));
    }

    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpiry = undefined;
    await user.save();

    await sendWelcomeNotification(user.email, user.phone, user.name);
    await user.populate("roles", "name permissions");

    const { accessToken, refreshToken } = generateTokens(user as any);

    res.status(200).json({
      success: true,
      message: "Account verified successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          roles: user.roles,
          isVerified: user.isVerified
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error: any) {
    next(errorHandler(500, `Server error during verification: ${error.message}`));
  }
};
```

#### `login(credentials)`
**Purpose:** Authenticate user and issue tokens  
**Access:** Public  
**Validation:**
- Password required
- Email or phone required
- User must be active
**Process:**
- Verify credentials
- Update `lastLoginAt` timestamp
- Issue access/refresh tokens
**Response:** User data + access/refresh tokens

**Controller Implementation:**
```typescript
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, phone, password }: { email?: string; phone?: string; password: string } = req.body;

    if (!password || (!email && !phone)) {
      return next(errorHandler(400, "Password and email/phone are required"));
    }

    const query = email ? { email: email.toLowerCase() } : { phone };
    const user = await User.findOne(query).select("+password");

    if (!user) {
      return next(errorHandler(401, "Invalid credentials"));
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password!);
    if (!isPasswordValid) {
      return next(errorHandler(401, "Invalid credentials"));
    }

    if (!user.isActive) {
      return next(errorHandler(403, "Account is deactivated"));
    }

    user.lastLoginAt = new Date();
    await user.save();

    await user.populate("roles", "name permissions");
    const { accessToken, refreshToken } = generateTokens(user as any);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          roles: user.roles,
          isVerified: user.isVerified
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error during login"));
  }
};
```

#### `logout()`
**Purpose:** Log out user  
**Access:** Authenticated users  
**Validation:** None  
**Process:** Return success (client clears token locally)  
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const logout = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  res.status(200).json({
    success: true,
    message: "Logged out successfully"
  });
};
```

#### `forgotPassword(email)`
**Purpose:** Send password reset instructions  
**Access:** Public  
**Validation:** Email is required and must exist  
**Process:**
- Generate random reset token
- Persist token and 15-minute expiry
- Send reset notification
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) return next(errorHandler(400, "Email is required"));

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return next(errorHandler(404, "User not found"));

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    await user.save();

    await sendPasswordResetNotification(user.email, user.phone, resetToken, user.name);

    res.status(200).json({
      success: true,
      message: "Password reset instructions sent"
    });
  } catch (error) {
    next(errorHandler(500, "Error during password reset request"));
  }
};
```

#### `resetPassword(token, newPassword)`
**Purpose:** Reset password using token  
**Access:** Public  
**Validation:** Token and new password required; token must be valid/not expired  
**Process:**
- Hash new password
- Clear reset fields
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!token || !newPassword) return next(errorHandler(400, "Token and new password are required"));

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: new Date() }
    });

    if (!user) return next(errorHandler(400, "Invalid or expired reset token"));

    user.password = bcrypt.hashSync(newPassword, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password updated successfully"
    });
  } catch (error) {
    next(errorHandler(500, "Error during password reset"));
  }
};
```

#### `refreshToken(refreshToken)`
**Purpose:** Generate new access token pair  
**Access:** Public  
**Validation:** Valid refresh token and active user  
**Process:** Verify refresh token and issue new token pair  
**Response:** New access/refresh tokens

**Controller Implementation:**
```typescript
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return next(errorHandler(400, "Refresh token is required"));

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || "default_refresh_secret") as any;
    const user = await User.findById(decoded.userId).populate("roles", "name permissions");

    if (!user || !user.isActive) return next(errorHandler(401, "User not found or inactive"));

    const tokens = generateTokens(user as any);

    res.status(200).json({
      success: true,
      data: tokens
    });
  } catch (err) {
    next(errorHandler(401, "Invalid refresh token"));
  }
};
```

#### `getMe()`
**Purpose:** Get current user profile  
**Access:** Authenticated users  
**Validation:** User must exist  
**Process:** Fetch profile with populated roles and permissions  
**Response:** User data

**Controller Implementation:**
```typescript
export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id).populate("roles", "name permissions");
    if (!user) return next(errorHandler(404, "User not found"));

    res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(errorHandler(500, "Error fetching profile"));
  }
};
```
---

## 🛣️ Authentication Routes

### Base Path: `/api/auth`

```typescript
POST   /register                 // Register with Invitation Code
POST   /verify-otp               // Verify OTP and activate account
POST   /login                    // Login (Email/Phone + Password)
POST   /logout                   // Invalidate session (requires token)
POST   /forgot-password          // Request reset token
POST   /reset-password/:token    // Reset password with token
POST   /refresh-token            // Issue new token pair
GET    /me                       // Get current user profile
```

### Router Implementation

**File: `src/routes/authRoutes.ts`**

```typescript
import express from "express";
import {
  register,
  verifyOTP,
  login,
  logout,
  refreshToken,
  getMe,
  forgotPassword,
  resetPassword
} from "../controllers/authController";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

router.post("/register", register);
router.post("/verify-otp", verifyOTP);
router.post("/login", login);
router.get("/me", authenticateToken, getMe);
router.post("/logout", authenticateToken, logout);
router.post("/refresh-token", refreshToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

export default router;
```

### Route Details

#### `POST /api/auth/register`
**Body:**
```json
{
  "invitationCode": "SAVE-1234",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+254700000000",
  "password": "securePass123"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Registration successful. Please verify your identity with the OTP sent.",
  "data": {
    "userId": "...",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+254700000000",
    "isVerified": false
  }
}
```

#### `POST /api/auth/verify-otp`
**Body:**
```json
{
  "email": "jane@example.com",
  "otp": "123456"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Account verified successfully",
  "data": {
    "user": {
      "id": "...",
      "name": "Jane Doe",
      "isVerified": true,
      "roles": [...]
    },
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

#### `POST /api/auth/login`
**Body:**
```json
{
  "phone": "+254700000000",
  "password": "securePass123"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "id": "...", "name": "Jane Doe", "roles": [...] },
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

---

## 🛡️ Middleware

### Authentication & Authorization

#### `authenticateToken`
**Purpose:** Verifies JWT and populates `req.user` and `req.permissions` (flattened from all roles).  
**Usage:**
```typescript
router.get("/protected", authenticateToken, controller);
```

#### `authorizePermissions(requiredPermissions)`
**Purpose:** Enforces RBAC by checking if the user has all required permission strings.  
**Example:**
```typescript
router.post("/payout/approve", authenticateToken, authorizePermissions(["can_approve_payout"]), approveHandler);
```

#### `checkMemberStatus`
**Purpose:** Ensures the member is both `isVerified` (OTP) and `isActive` before accessing sensitive features.  
**Usage:**
```typescript
router.post("/contribute", authenticateToken, checkMemberStatus, contributeHandler);
```

---

## 📝 API Examples

### Complete Authentication Flow

#### 1. Register with Invitation Code
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "invitationCode": "FAM-XYZ-123",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+254711223344",
    "password": "Password123!"
  }'
```

#### 2. Verify OTP
```bash
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+254711223344",
    "otp": "123456"
  }'
```

#### 3. Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane@example.com",
    "password": "Password123!"
  }'
```

---

## 🔒 Security Features

### Identity Gate
- **Invitation Only:** Registration requires a valid, unused invitation code linked to a specific family program.
- **OTP Verification:** 6-digit numeric OTP via Africa's Talking (SMS/Email) is mandatory for account activation.

### RBAC & Permissions
- **Granular Permissions:** Access is controlled via specific permissions (e.g., `can_initiate_payout`) instead of generic role names.
- **Flattened Permissions:** Middleware aggregates permissions from multiple roles if assigned.

### Password & Token Security
- **Bcrypt:** Passwords hashed with 12 salt rounds.
- **JWT:** Short-lived access tokens (15m) and secure refresh tokens (7d).
- **Double-Lock:** Payouts require dual authorization from different roles (`treasurer` and `chairman`).

---

**Last Updated:** March 2026  
**Version:** 1.0.0
