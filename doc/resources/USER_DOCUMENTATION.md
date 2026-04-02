# 👥 Saveplan API - User Management Documentation

## 📋 Table of Contents
- [User Management Overview](#user-management-overview)
- [User Model](#user-model)
- [User Controller](#user-controller)
- [User Routes](#user-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)
- [Database Indexes](#database-indexes)

---

## 🔑 User Management Overview

The User Management system for Saveplan API provides a unified interface for managing family members. It supports granular profile updates, security-conscious password management, and comprehensive administrative oversight (Chairman/Secretary). All users are managed through a single User model and are governed by a robust Role-Based Access Control (RBAC) system.

### Core Features
1. **Self-Service Profile** → Update name, phone, and notification preferences.
2. **Secure Password Management** → Verified password changes with bcrypt hashing.
3. **Administrative Oversight** → Paginated search and detailed member viewing for leaders.
4. **Account Lifecycle** → Activate, deactivate, or delete member accounts.
5. **Role Integration** → Seamless integration with the RBAC system.

---

## 🗄️ User Model

### Schema Definition
```typescript
interface IUser {
  _id: string;
  name: string;
  email: string;
  password: string;
  phone: string; // M-Pesa Number
  isVerified: boolean;
  isActive: boolean;
  roles: ObjectId[]; // Ref: Role
  notificationPreferences: {
    email: boolean;
    sms: boolean;
    contributionAlerts: boolean;
    payoutUpdates: boolean;
  };
  lastLoginAt?: Date;
  otpCode?: string;
  otpExpiry?: Date;
  resetPasswordToken?: string;
  resetPasswordExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/User.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import type { IUser } from '../types/index';

const userSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  phone: { type: String, required: true, unique: true, trim: true },
  isVerified: { type: Boolean, default: false },
  lastLoginAt: { type: Date },
  roles: [{ type: Schema.Types.ObjectId, ref: 'Role' }],
  notificationPreferences: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    contributionAlerts: { type: Boolean, default: true },
    payoutUpdates: { type: Boolean, default: true }
  },
  isActive: { type: Boolean, default: true },
  otpCode: { type: String, select: false },
  otpExpiry: { type: Date, select: false },
  resetPasswordToken: { type: String, select: false },
  resetPasswordExpiry: { type: Date, select: false }
}, { timestamps: true });

const User = mongoose.model<IUser>('User', userSchema);
export default User;
```

---

## 🎮 User Controller

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { errorHandler } from "../middleware/errorHandler";
import User from "../models/User";
import Role from "../models/Role";
```

### Functions Overview

#### `updateUserProfile(userData)`
**Purpose:** Update the profile details of the authenticated family member  
**Access:** Authenticated Users  
**Validation:** Valid profile fields provided in request body  
**Process:**
- Find authenticated user
- Update provided fields (name, phone, notificationPreferences)
- Persist changes to database
**Response:** Success message + updated user summary

**Controller Implementation:**
```typescript
export const updateUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, phone, notificationPreferences } = req.body;
    const user = await User.findById(req.user?._id);

    if (!user) return next(errorHandler(404, "Profile not found"));

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (notificationPreferences) {
      user.notificationPreferences = { ...user.notificationPreferences, ...notificationPreferences };
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          roles: user.roles,
          isVerified: user.isVerified
        }
      }
    });
  } catch (error) {
    next(errorHandler(500, "Error updating profile"));
  }
};
```

#### `changePassword(credentials)`
**Purpose:** Change authenticated user password after current password verification  
**Access:** Authenticated Users  
**Validation:**
- Current password and new password required
- Current password must match stored hash
**Process:**
- Fetch user with password field
- Compare current password with stored hash
- Hash and store new password if valid
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return next(errorHandler(400, "Current password and new password are required"));
    }

    const user = await User.findById(req.user?._id).select("+password");
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    const ok = bcrypt.compareSync(currentPassword, user.password!);
    if (!ok) {
      return next(errorHandler(400, "Current password is incorrect"));
    }

    user.password = bcrypt.hashSync(newPassword, 12);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while changing password"));
  }
};
```

#### `getAllUsers(query)`
**Purpose:** Paginated search and list of all family members for administrative oversight  
**Access:** Chairman / Secretary  
**Validation:** Search string, role, and status filters  
**Process:**
- Build query based on search (name/email/phone), role, and status
- Fetch users with pagination and populated roles
- Calculate pagination metadata
**Response:** Array of users + pagination details

**Controller Implementation:**
```typescript
export const getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, role, status } = req.query;
    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ];
    }

    if (role) {
      const roleDoc = await Role.findOne({ name: String(role).toLowerCase() });
      if (!roleDoc) return next(errorHandler(404, "Role not found"));
      query.roles = roleDoc._id;
    }

    if (status === "active") query.isActive = true;
    else if (status === "inactive") query.isActive = false;
    
    if (status === "verified") query.isVerified = true;
    else if (status === "unverified") query.isVerified = false;

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    const users = await User.find(query)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name permissions")
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalUsers: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching users"));
  }
};
```

#### `getUserById(userId)`
**Purpose:** Fetch detailed profile of a specific family member  
**Access:** Chairman / Secretary  
**Validation:** User ID must be valid and exist  
**Process:** Find user and populate roles and permissions  
**Response:** Success message + full user profile

**Controller Implementation:**
```typescript
export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name permissions");

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching user"));
  }
};
```

#### `deleteMembers(userId)`
**Purpose:** Hard delete a family member account  
**Access:** Chairman  
**Validation:**
- User ID must exist
- Cannot delete self
**Process:** Remove user document from database  
**Response:** Success confirmation

**Controller Implementation:**
```typescript
export const deleteMembers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    
    if (req.user && String(req.user._id) === String(userId)) {
      return next(errorHandler(400, "You cannot delete your own account"));
    }

    const user = await User.findById(userId);
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: "Member deleted successfully"
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while deleting member"));
  }
};
```

#### `updateMemberStatus(userId, status)`
**Purpose:** Activate or deactivate a family member account  
**Access:** Chairman / Admin  
**Validation:** `isActive` flag required  
**Process:** Update user status and persist  
**Response:** Success message with updated status

**Controller Implementation:**
```typescript
export const updateMemberStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    if (isActive === undefined) {
      return next(errorHandler(400, "isActive status is required"));
    }

    const user = await User.findById(userId);
    if (!user) return next(errorHandler(404, "Member not found"));

    user.isActive = isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `Member account ${isActive ? "activated" : "deactivated"} successfully`
    });
  } catch (error) {
    next(errorHandler(500, "Error updating member status"));
  }
};
```

---

## 🛣️ User Routes

### Base Path: `/api/users`

```typescript
PUT    /update-profile           // Update own member profile
PUT    /change-password          // Change own password
GET    /oversight                // Paginated member search (Chairman/Secretary)
GET    /:userId                  // Get detailed profile of a member (Chairman/Secretary)
PUT    /:userId/status           // Activate/Deactivate a member (Admin/Chairman)
DELETE /:userId                  // Hard delete a member account (Chairman)
```

### Router Implementation

**File: `src/routes/userRoutes.ts`**

```typescript
import express from "express";
import {
  updateUserProfile,
  changePassword,
  getAllUsers,
  getUserById,
  deleteMembers,
  updateMemberStatus
} from "../controllers/userController";
import { authenticateToken, authorizePermissions } from "../middleware/auth";

const router = express.Router();

router.put("/update-profile", authenticateToken, updateUserProfile);

router.put("/change-password", authenticateToken, changePassword);

router.get("/oversight", authenticateToken, authorizePermissions(["can_view_all_ledgers"]), getAllUsers);

router.get("/:userId", authenticateToken, authorizePermissions(["can_view_all_ledgers"]), getUserById);

router.put("/:userId/status", authenticateToken, authorizePermissions(["can_update_profiles"]), updateMemberStatus);

router.delete("/:userId", authenticateToken, authorizePermissions(["can_manage_roles"]), deleteMembers);

export default router;
```

---

## 🛡️ Middleware

### `authenticateToken`
**Purpose:** Verifies JWT and populates `req.user`.

### `authorizePermissions(requiredPermissions)`
**Purpose:** Restricts access to administrative endpoints (Oversight, Deletion, Status Updates) based on user role permissions.

---

## 📝 API Examples

### Update Own Profile
```bash
curl -X PUT http://localhost:5000/api/users/update-profile \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "phone": "+254711223344",
    "notificationPreferences": { "sms": false }
  }'
```

### Admin Oversight (List Members)
```bash
curl -X GET "http://localhost:5000/api/users/oversight?search=John&status=active&page=1&limit=5" \
  -H "Authorization: Bearer <admin_token>"
```

---

## 🔒 Security Features

- **Sensitive Field Isolation** → Passwords, OTPs, and reset tokens are excluded from all oversight queries.
- **Bcrypt Hashing** → Secure 12-round hashing for all password updates.
- **Granular RBAC** → Strict permission-based gating for all sensitive operations (e.g., account deletion).
- **Identity Integrity** → Primary identifiers (email, phone) are strictly validated.

---

## 📊 Database Indexes

```typescript
userSchema.index({ phone: 1 });
userSchema.index({ email: 1 });
```

---

**Last Updated:** March 2026  
**Version:** 1.0.0
