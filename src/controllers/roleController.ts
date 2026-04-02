import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Role from "../models/Role";
import User from "../models/User";

/**
 * List all available system roles with pagination and search.
 * Restricted to Chairman.
 */
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

/**
 * Fetch details of a specific role by ID.
 */
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

/**
 * Create a new system role.
 */
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

/**
 * Update role metadata or permissions.
 */
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

/**
 * Delete a custom role (Chairman only).
 */
export const deleteRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { roleId } = req.params;
    
    const role = await Role.findById(roleId);
    if (!role) {
      return next(errorHandler(404, "Role not found"));
    }

    // Check if any users are assigned to this role
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

/**
 * Get all members assigned to a specific role with pagination.
 */
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

/**
 * Assign or remove roles from a family member.
 * Restricted to Chairman.
 */
export const manageRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, roleNames } = req.body; // e.g., ["member", "treasurer"]

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
