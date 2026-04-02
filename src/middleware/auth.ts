import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import User from "../models/User";
import { errorHandler } from "./errorHandler";

declare global {
  namespace Express {
    interface Request {
      user?: any; // Populated IUser
      roles?: string[]; // Array of role names
    }
  }
}

/**
 * Verifies JWT and populates req.user and req.roles.
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

    // Extract role names from the populated roles
    const roles = (user.roles as any[]).map((role: any) => role.name);

    req.user = user;
    req.roles = roles;

    next();
  } catch (err) {
    next(errorHandler(401, "Invalid or expired token"));
  }
};

/**
 * Enforces RBAC by checking if the user has at least one of the required roles.
 */
export const authorizeRoles = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.roles) {
      return next(errorHandler(403, "Insufficient permissions (No roles assigned)"));
    }

    const hasRole = allowedRoles.some(role => req.roles?.includes(role));

    if (!hasRole) {
      return next(errorHandler(403, "Insufficient permissions: Access denied for your role"));
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
