import Payment from '../../models/Payment';
import Contribution from '../../models/Contribution';
import { initiateStkPush } from '../external/darajaService';
import type { IPayment } from '../../types';

/**
 * Generate a sequential payment number: PAY-YYYY-XXXX.
 */
export const generatePaymentNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const count = await Payment.countDocuments({
    createdAt: { $gte: new Date(year, 0, 1) }
  });
  return `PAY-${year}-${String(count + 1).padStart(4, "0")}`;
};

/**
 * Create a PENDING payment record.
 */
export const createPaymentRecord = async (params: {
  memberId: string;
  contributionId?: string;
  amount: number;
  method: "MPESA" | "CASH";
}): Promise<IPayment> => {
  const paymentNumber = await generatePaymentNumber();
  return await Payment.create({
    ...params,
    paymentNumber,
    status: "PENDING"
  } as any);
};

/**
 * Apply a successful payment to the associated contribution.
 */
export const applySuccessfulPayment = async (payment: IPayment, io?: any): Promise<void> => {
  payment.status = "SUCCESS";
  await payment.save();

  if (payment.contributionId) {
    const contribution = await Contribution.findById(payment.contributionId);
    if (contribution) {
      contribution.status = "COMPLETED";
      contribution.paymentId = payment.paymentNumber;
      contribution.transactionDate = new Date();
      await contribution.save();

      if (io) {
        io.emit("contribution.updated", { 
          contributionId: contribution._id, 
          status: "COMPLETED" 
        });
      }
    }
  }

  if (io) {
    io.emit("payment.updated", { 
      paymentId: payment._id, 
      status: "SUCCESS" 
    });
  }
};

/**
 * Orchestrate M-Pesa STK Push payment.
 */
export const initiateMpesaPayment = async (params: {
  payment: IPayment;
  phone: string;
  accountReference: string;
}): Promise<any> => {
  const { payment, phone, accountReference } = params;

  const res = await initiateStkPush({
    amount: payment.amount,
    phone,
    accountReference
  });

  payment.processorRefs = {
    daraja: {
      merchantRequestId: res.merchantRequestId,
      checkoutRequestId: res.checkoutRequestId
    }
  };
  await payment.save();

  return res;
};
