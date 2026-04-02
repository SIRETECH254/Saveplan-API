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

/**
 * Register a new family member with a valid Invitation Code and M-Pesa phone number.
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      invitationCode,
      name,
      email,
      phone,
      password
    }: {
      invitationCode?: string;
      name: string;
      email: string;
      phone: string;
      password: string;
    } = req.body;

    if (!name || !email || !phone || !password) {
      return next(errorHandler(400, "Name, email, phone, and password are required"));
    }

    // Check if this is the first user in the system
    const userCount = await User.countDocuments();
    const isFirstUser = userCount === 0;

    let roleName: "member" | "chairman" = "member";
    let codeDoc = null;

    if (isFirstUser) {
      // First user becomes the Chairman automatically, no invitation code needed
      roleName = "chairman";
    } else {
      // Not the first user, invitation code is MANDATORY
      if (!invitationCode) {
        return next(errorHandler(400, "Invitation code is required for registration"));
      }

      // Validate Invitation Code
      codeDoc = await InvitationCode.findOne({
        code: invitationCode.toUpperCase(),
        isUsed: false,
        expiresAt: { $gt: new Date() }
      });

      if (!codeDoc) {
        return next(errorHandler(400, "Invalid or expired invitation code"));
      }
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

    const assignedRole = await Role.findOne({ name: roleName });
    if (!assignedRole) {
      return next(errorHandler(500, `Default role '${roleName}' not configured. Please seed roles.`));
    }

    const user = new User({
      name,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      roles: [assignedRole._id],
      otpCode: otp,
      otpExpiry,
      isVerified: false
    });

    await user.save();

    // Mark invitation code as used if it was provided (for non-first users)
    if (codeDoc) {
      codeDoc.isUsed = true;
      codeDoc.usedBy = user._id;
      await codeDoc.save();
    }

    // Send OTP via internal notification service (Email/SMS)
    await sendOTPNotification(email, phone, otp, name);

    res.status(201).json({
      success: true,
      message: `Registration successful as ${roleName}. Please verify your identity with the OTP sent.`,
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: roleName,
        isVerified: user.isVerified
      }
    });
  } catch (error: any) {
    next(errorHandler(500, `Server error during registration: ${error.message}`));
  }
};

/**
 * Verify OTP sent during registration or login.
 */
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

/**
 * Authenticate family member and issue JWT tokens.
 */
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

/**
 * Get current authenticated user profile.
 */
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

/**
 * Logout user (client should discard token).
 */
export const logout = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  res.status(200).json({
    success: true,
    message: "Logged out successfully"
  });
};

/**
 * Refresh expired access token using a valid refresh token.
 */
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

/**
 * Request password reset link.
 */
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
      message: "Password reset instructions sent the email"
    });
  } catch (error) {
    next(errorHandler(500, "Error during password reset request"));
  }
};

/**
 * Reset password using token.
 */
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

/**
 * Resend OTP code if the previous one expired or was not received.
 */
export const resendOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, phone }: { email?: string; phone?: string } = req.body;

    if (!email && !phone) {
      return next(errorHandler(400, "Email or phone is required to resend OTP"));
    }

    const query = email ? { email: email.toLowerCase() } : { phone };
    const user = await User.findOne(query);

    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    if (user.isVerified) {
      return next(errorHandler(400, "Account is already verified"));
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.otpCode = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    await sendOTPNotification(user.email, user.phone, otp, user.name);

    res.status(200).json({
      success: true,
      message: "A new OTP has been sent to your email/phone"
    });
  } catch (error: any) {
    next(errorHandler(500, `Server error during OTP resend: ${error.message}`));
  }
};
