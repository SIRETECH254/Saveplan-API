import jwt from "jsonwebtoken";
import type { IUser } from "../types/index";

/**
 * Generates a 6-digit numeric OTP.
 */
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Generates Access and Refresh Tokens for an authenticated user.
 */
export const generateTokens = (user: IUser) => {
  const accessToken = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET || "default_secret",
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { userId: user._id },
    process.env.JWT_REFRESH_SECRET || "default_refresh_secret",
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
};
