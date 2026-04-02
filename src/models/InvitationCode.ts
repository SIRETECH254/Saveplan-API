import mongoose, { Schema } from 'mongoose';
import type { IInvitationCode } from '../types/index';

const invitationCodeSchema = new Schema<IInvitationCode>({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  isUsed: { type: Boolean, default: false },
  usedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

invitationCodeSchema.index({ code: 1, isUsed: 1 });

const InvitationCode = mongoose.model<IInvitationCode>('InvitationCode', invitationCodeSchema);
export default InvitationCode;
