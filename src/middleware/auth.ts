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

/**
 * Verifies JWT and populates req.user with roles and flat permissions.
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return next(errorHandler(401, "Access token required"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret") as any;
    const user = await User.findById(decoded.userId).populate("roles");

    if (!user || !user.isActive) {
      return next(errorHandler(401, "User unauthorized or inactive"));
    }

    // Flatten permissions from all assigned roles
    const permissions = (user.roles as any[]).flatMap((role: any) => role.permissions);

    req.user = user;
    req.permissions = [...new Set(permissions)];

    next();
  } catch (err) {
    next(errorHandler(401, "Invalid or expired token"));
  }
};

/**
 * Enforces RBAC by checking if the user has all required permissions.
 */
export const authorizePermissions = (requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.permissions) {
      return next(errorHandler(403, "Insufficient permissions (No roles assigned)"));
    }

    const hasPermission = requiredPermissions.every(p => req.permissions?.includes(p));

    if (!hasPermission) {
      return next(errorHandler(403, "Insufficient permissions for this action"));
    }

    next();
  };
};

/**
 * Ensures the member is verified and active before accessing sensitive features.
 */
export const checkMemberStatus = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(errorHandler(401, "Authentication required"));
  
  if (!req.user.isVerified) {
    return next(errorHandler(403, "Please verify your account (OTP) to continue"));
  }

  if (!req.user.isActive) {
    return next(errorHandler(403, "Your account is currently inactive"));
  }

  next();
};
