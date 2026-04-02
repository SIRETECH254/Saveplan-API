import { Document, Types } from 'mongoose';

export interface IRole extends Document {
  name: "member" | "treasurer" | "chairman" | "secretary";
  description: string;
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  phone: string; // Primary M-Pesa Number
  isVerified: boolean;
  lastLoginAt?: Date;
  roles: Types.ObjectId[] | IRole[];
  notificationPreferences: {
    email: boolean;
    sms: boolean;
    contributionAlerts: boolean;
    payoutUpdates: boolean;
  };
  isActive: boolean;
  otpCode?: string;
  otpExpiry?: Date;
  resetPasswordToken?: string;
  resetPasswordExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInvitationCode extends Document {
  code: string;
  createdBy: Types.ObjectId | IUser;
  isUsed: boolean;
  usedBy?: Types.ObjectId | IUser;
  expiresAt: Date;
  createdAt: Date;
}

export interface IContribution extends Document {
  memberId: Types.ObjectId | IUser;
  amount: number;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  paymentId?: string;
  transactionDate: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPayout extends Document {
  memberId: Types.ObjectId | IUser;
  totalContributed: number;
  payoutAmount: number;
  status: "DRAFT" | "INITIATED" | "APPROVED" | "COMPLETED" | "FAILED";
  initiatedBy: Types.ObjectId | IUser;
  approvedBy?: Types.ObjectId | IUser;
  paymentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}
