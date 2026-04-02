import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { errorHandler } from "../middleware/errorHandler";
import User from "../models/User";
import Role from "../models/Role";

// Update the profile details of the authenticated family member.
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

// Change authenticated user password after current password verification.
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

// Paginated search and list of all family members.
// Accessible to Chairman and Secretary for administrative oversight.
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

// Fetch detailed profile of a specific family member.
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

// Hard delete a family member account (Chairman only).
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

// Activate or deactivate a family member account.
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
