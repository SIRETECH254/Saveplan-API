import mongoose, { Schema } from 'mongoose';
import type { IPayment } from '../types/index';

const paymentSchema = new Schema<IPayment>({
  memberId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User' 
  },
  contributionId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Contribution' 
  },
  paymentNumber: { 
    type: String, 
    required: true, 
    unique: true 
  },
  amount: { 
    type: Number, 
    required: true,
    min: 0
  },
  currency: { 
    type: String, 
    enum: ["KES"], 
    default: "KES" 
  },
  status: { 
    type: String, 
    enum: ["PENDING", "SUCCESS", "FAILED"], 
    default: "PENDING" 
  },
  method: { 
    type: String, 
    enum: ["MPESA", "CASH"], 
    required: true 
  },
  transactionRef: { 
    type: String 
  },
  processorRefs: {
    daraja: {
      merchantRequestId: { type: String },
      checkoutRequestId: { type: String }
    }
  }
}, { timestamps: true });

// Indexing for faster queries
paymentSchema.index({ memberId: 1 });
paymentSchema.index({ contributionId: 1 });
paymentSchema.index({ status: 1, createdAt: 1 });
paymentSchema.index({ "processorRefs.daraja.checkoutRequestId": 1 });

const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
export default Payment;
