import mongoose, { Schema } from 'mongoose';
import type { IUser } from '../types/index';

const userSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  phone: { type: String, required: true, unique: true, trim: true }, // M-Pesa Number
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
