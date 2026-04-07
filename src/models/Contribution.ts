import mongoose, { Schema } from 'mongoose';
import type { IContribution } from '../types/index';

const contributionSchema = new Schema<IContribution>({
  memberId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  contributionNumber: { 
    type: String, 
    required: true, 
    unique: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ["PENDING", "COMPLETED", "CANCELLED"], 
    default: "PENDING" 
  },
  paymentId: { 
    type: String 
  },
  transactionDate: { 
    type: Date 
  },
  notes: { 
    type: String 
  }
}, { timestamps: true });

// Indexing for faster queries
contributionSchema.index({ memberId: 1 });
contributionSchema.index({ status: 1 });

const Contribution = mongoose.model<IContribution>('Contribution', contributionSchema);
export default Contribution;
