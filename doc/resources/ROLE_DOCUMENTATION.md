# 🎭 Saveplan API - Role Management System Documentation

## 📋 Table of Contents
- [Role Overview](#role-overview)
- [Role Model](#role-model)
- [Role Controller](#role-controller)
- [Role Routes](#role-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Scripts](#scripts)
- [Security Features](#security-features)

---

## 🔑 Role Overview

The Saveplan API uses a unified Role-Based Access Control (RBAC) system where family members are assigned specific roles that govern their permissions and access levels throughout the platform. This ensures secure management of contributions, payouts, and family program settings.

### Role System Features
- **Permission-Based** - Each role is associated with a specific set of permission strings (e.g., `can_approve_payout`).
- **Unified Model** - Roles are stored in a centralized database and assigned to users via references.
- **Double-Lock Support** - Special roles (`treasurer` and `chairman`) are required for executing payouts.
- **Dynamic Fetching** - Permissions are flattened and loaded into the user's session upon authentication.

### Default Roles
- `member` - Standard family member (default role).
- `treasurer` - Financial lead (Key 1 of Double-Lock).
- `chairman` - Governance lead (Key 2 of Double-Lock).
- `secretary` - Administrative support.

---

## 🗄️ Role Model

### Schema Definition
```typescript
interface IRole {
  _id: string;
  name: "member" | "treasurer" | "chairman" | "secretary";
  description: string;
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/Role.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import type { IRole } from '../types/index';

const roleSchema = new Schema<IRole>({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: ["member", "treasurer", "chairman", "secretary"],
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  permissions: [{ 
    type: String, 
    trim: true 
  }],
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { timestamps: true });

const Role = mongoose.model<IRole>('Role', roleSchema);
export default Role;
```

---

## 🎮 Role Controller

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Role from "../models/Role";
import User from "../models/User";
```

### Functions Overview

#### `getAllRoles(query)`
**Purpose:** List all available system roles with pagination and search  
**Access:** Chairman / Secretary  
**Validation:** `page`, `limit`, and `search` query parameters  
**Process:** Build query based on search string, fetch roles with pagination  
**Response:** Paginated list of roles

**Controller Implementation:**
```typescript
export const getAllRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    const roles = await Role.find(query)
      .sort({ name: 1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Role.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        roles,
        pagination: {
          currentPage: options.page,
          totalPages: Math.ceil(total / options.limit),
          totalRoles: total,
          hasNextPage: options.page < Math.ceil(total / options.limit),
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error) {
    next(errorHandler(500, "Error fetching roles"));
  }
};
```

#### `getRole(roleId)`
**Purpose:** Fetch details of a specific role by ID  
**Access:** Chairman / Secretary  
**Validation:** Role ID must exist  
**Process:** Fetch role by ID from database  
**Response:** Role details

**Controller Implementation:**
```typescript
export const getRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { roleId } = req.params;
    const role = await Role.findById(roleId);

    if (!role) {
      return next(errorHandler(404, "Role not found"));
    }

    res.status(200).json({
      success: true,
      data: { role }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while fetching role"));
  }
};
```

#### `createRole(roleData)`
**Purpose:** Create a new system role  
**Access:** Chairman  
**Validation:** Name and description required; name must be unique  
**Process:** Validate and save new role document  
**Response:** Success message + created role

**Controller Implementation:**
```typescript
export const createRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, permissions } = req.body;

    if (!name || !description) {
      return next(errorHandler(400, "Name and description are required"));
    }

    const existingRole = await Role.findOne({ name: name.toLowerCase() });
    if (existingRole) {
      return next(errorHandler(400, "Role name already exists"));
    }

    const role = new Role({
      name: name.toLowerCase(),
      description,
      permissions: permissions || []
    });

    await role.save();

    res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: { role }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while creating role"));
  }
};
```

#### `updateRole(roleId, updates)`
**Purpose:** Update role metadata or permissions  
**Access:** Chairman  
**Validation:** Role ID must exist  
**Process:** Update provided fields (description, permissions, isActive)  
**Response:** Success message + updated role

**Controller Implementation:**
```typescript
export const updateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { roleId } = req.params;
    const { description, permissions, isActive } = req.body;

    const role = await Role.findById(roleId);
    if (!role) {
      return next(errorHandler(404, "Role not found"));
    }

    if (description) role.description = description;
    if (permissions) role.permissions = permissions;
    if (isActive !== undefined) role.isActive = isActive;

    await role.save();

    res.status(200).json({
      success: true,
      message: "Role updated successfully",
      data: { role }
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while updating role"));
  }
};
```

#### `deleteRole(roleId)`
**Purpose:** Delete a custom role  
**Access:** Chairman  
**Validation:** Role ID must exist; role must not be assigned to any users  
**Process:** Check for user assignments, then delete document  
**Response:** Success message

**Controller Implementation:**
```typescript
export const deleteRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { roleId } = req.params;
    
    const role = await Role.findById(roleId);
    if (!role) {
      return next(errorHandler(404, "Role not found"));
    }

    const usersWithRole = await User.countDocuments({ roles: roleId });
    if (usersWithRole > 0) {
      return next(errorHandler(400, `Cannot delete role. ${usersWithRole} user(s) are assigned to it.`));
    }

    await Role.findByIdAndDelete(roleId);

    res.status(200).json({
      success: true,
      message: "Role deleted successfully"
    });
  } catch (error: any) {
    next(errorHandler(500, "Server error while deleting role"));
  }
};
```

#### `getMembersByRole(roleId, query)`
**Purpose:** Get all members assigned to a specific role with pagination  
**Access:** Chairman / Secretary  
**Validation:** Role ID must exist; paginated query parameters  
**Process:** Find members having the roleId in their roles array, with search support  
**Response:** Paginated list of members

**Controller Implementation:**
```typescript
export const getMembersByRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { roleId } = req.params;
    const { page = 1, limit = 10, search } = req.query;

    const role = await Role.findById(roleId);
    if (!role) {
      return next(errorHandler(404, "Role not found"));
    }

    const query: any = { roles: roleId };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ];
    }

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    };

    const users = await User.find(query)
      .select("-password -otpCode -resetPasswordToken")
      .populate("roles", "name")
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
    next(errorHandler(500, "Server error while fetching users by role"));
  }
};
```

#### `manageRoles(assignmentData)`
**Purpose:** Assign or remove roles from a family member  
**Access:** Chairman  
**Validation:** User ID and roleNames array required  
**Process:** Update user's roles array based on provided names  
**Response:** Success message + updated role list

**Controller Implementation:**
```typescript
export const manageRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, roleNames } = req.body;

    if (!userId || !roleNames || !Array.isArray(roleNames)) {
      return next(errorHandler(400, "User ID and role names array are required"));
    }

    const user = await User.findById(userId);
    if (!user) return next(errorHandler(404, "Member not found"));

    const roles = await Role.find({ name: { $in: roleNames } });
    if (roles.length !== roleNames.length) {
      return next(errorHandler(400, "One or more roles are invalid"));
    }

    user.roles = roles.map(r => r._id) as any;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Roles updated successfully",
      data: { userId: user._id, roles: roleNames }
    });
  } catch (error) {
    next(errorHandler(500, "Error updating member roles"));
  }
};
```

---

## 🛣️ Role Routes

### Base Path: `/api/admin`

```typescript
GET    /roles                       // List roles with pagination & search
GET    /roles/:roleId               // Fetch specific role by ID
POST   /roles                       // Create new system role
PUT    /roles/:roleId               // Update role metadata/permissions
DELETE /roles/:roleId               // Delete a custom role
GET    /roles/:roleId/members       // List members assigned to a role
POST   /manage-roles                // Assign roles to a member
```

### Router Implementation

**File: `src/routes/roleRoutes.ts`**

```typescript
import express from "express";
import {
  getAllRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  getMembersByRole,
  manageRoles
} from "../controllers/roleController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = express.Router();

router.get("/roles", authenticateToken, authorizeRoles(["chairman"]), getAllRoles);
router.get("/roles/:roleId", authenticateToken, getRole);
router.post("/roles", authenticateToken, authorizeRoles(["chairman"]), createRole);
router.put("/roles/:roleId", authenticateToken, authorizeRoles(["chairman"]), updateRole);
router.delete("/roles/:roleId", authenticateToken, authorizeRoles(["chairman"]), deleteRole);
router.get("/roles/:roleId/members", authenticateToken, authorizeRoles(["chairman"]), getMembersByRole);
router.post("/manage-roles", authenticateToken, authorizeRoles(["chairman"]), manageRoles);

export default router;
```

### Route Details

#### `GET /api/admin/roles`
**Query Params:** `page=1`, `limit=10`, `search=treasurer`  
**Response:**
```json
{
  "success": true,
  "data": {
    "roles": [...],
    "pagination": { "currentPage": 1, "totalPages": 1, ... }
  }
}
```

#### `GET /api/admin/roles/:roleId`
**Response:**
```json
{
  "success": true,
  "data": {
    "role": { "name": "member", "permissions": [...] }
  }
}
```

#### `POST /api/admin/roles`
**Body:** `{ "name": "new_role", "description": "...", "permissions": ["..."] }`  
**Response:**
```json
{
  "success": true,
  "message": "Role created successfully",
  "data": { "role": { ... } }
}
```

#### `PUT /api/admin/roles/:roleId`
**Body:** `{ "description": "Updated", "permissions": ["new_perm"] }`  
**Response:**
```json
{
  "success": true,
  "message": "Role updated successfully",
  "data": { "role": { ... } }
}
```

#### `DELETE /api/admin/roles/:roleId`
**Response:** `{ "success": true, "message": "Role deleted successfully" }`

#### `GET /api/admin/roles/:roleId/members`
**Query Params:** `page=1`, `limit=5`, `search=Jane`  
**Response:**
```json
{
  "success": true,
  "data": {
    "users": [...],
    "pagination": { ... }
  }
}
```

#### `POST /api/admin/manage-roles`
**Body:** `{ "userId": "...", "roleNames": ["member", "treasurer"] }`  
**Response:**
```json
{
  "success": true,
  "message": "Roles updated successfully",
  "data": { "userId": "...", "roles": ["member", "treasurer"] }
}
```

---

## 🛡️ Middleware

### `authorizePermissions(['can_manage_roles'])`
Restricts access to administrative endpoints based on user role permissions (Chairman/Admin).

---

## 📝 API Examples

### List Roles with Search
```bash
curl -X GET "http://localhost:5000/api/admin/roles?search=treasurer" \
  -H "Authorization: Bearer <token>"
```

### Assign Roles to Member
```bash
curl -X POST http://localhost:5000/api/admin/manage-roles \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "65ab...",
    "roleNames": ["member", "chairman"]
  }'
```

---

## 📜 Scripts

### Seed Roles Script
**File:** `src/scripts/seedRoles.ts`  
**Purpose:** Initializes the database with mandatory system roles.  
**Command:** `npm run seed:roles`

---

## 🔒 Security Features

- **Double-Lock Integrity** - Separates initiation and approval permissions across treasurer and chairman roles.
- **Strict Role Validation** - Assignment is validated against existing system roles.
- **Permission Flattening** - Securely aggregates permissions from multiple roles.

---

**Last Updated:** March 2026  
**Version:** 1.0.0
