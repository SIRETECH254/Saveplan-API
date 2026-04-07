import type { Request, Response, NextFunction } from "express";
import Payment from "../models/Payment";
import Contribution from "../models/Contribution";
import User from "../models/User";
import { errorHandler } from "../middleware/errorHandler";
import {
  createPaymentRecord,
  applySuccessfulPayment,
  initiateMpesaPayment
} from "../services/internal/paymentService";
import { parseCallback, queryStkPushStatus } from "../services/external/darajaService";

/**
 * Initiate a contribution payment for a member (Self-service).
 */
export const initiateContributions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { amount, phone, contributionId } = req.body;
    const memberId = req.user?._id;

    if (!amount || !phone) {
      return next(errorHandler(400, "Amount and phone number are required"));
    }

    if (contributionId) {
      const contribution = await Contribution.findById(contributionId);
      if (!contribution) return next(errorHandler(404, "Contribution not found"));
      if (contribution.memberId.toString() !== memberId.toString()) {
        return next(errorHandler(403, "This contribution does not belong to you"));
      }
      if (contribution.status === "COMPLETED") {
        return next(errorHandler(400, "This contribution is already completed"));
      }
    }

    const payment = await createPaymentRecord({
      memberId,
      contributionId,
      amount,
      method: "MPESA"
    });

    const gateway = await initiateMpesaPayment({
      payment,
      phone,
      accountReference: contributionId || `NEW-${memberId.toString().slice(-6)}`
    });

    res.status(200).json({
      success: true,
      message: "Payment initiated",
      data: { payment, gateway }
    });
  } catch (error: any) {
    next(errorHandler(500, `Error initiating payment: ${error.message}`));
  }
};

/**
 * Initiate a contribution payment for a member by an Admin/Leader.
 */
export const initiateContributionAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { memberId, amount, phone, contributionId } = req.body;

    if (!memberId || !amount || !phone) {
      return next(errorHandler(400, "memberId, amount, and phone are required"));
    }

    const member = await User.findById(memberId);
    if (!member) return next(errorHandler(404, "Member not found"));

    if (contributionId) {
      const contribution = await Contribution.findById(contributionId);
      if (!contribution) return next(errorHandler(404, "Contribution not found"));
      if (contribution.status === "COMPLETED") {
        return next(errorHandler(400, "This contribution is already completed"));
      }
    }

    const payment = await createPaymentRecord({
      memberId,
      contributionId,
      amount,
      method: "MPESA"
    });

    const gateway = await initiateMpesaPayment({
      payment,
      phone,
      accountReference: contributionId || `ADM-${memberId.toString().slice(-6)}`
    });

    res.status(200).json({
      success: true,
      message: "Payment initiated by admin",
      data: { payment, gateway }
    });
  } catch (error: any) {
    next(errorHandler(500, `Error initiating admin payment: ${error.message}`));
  }
};

/**
 * Handle M-Pesa Webhook callback.
 */
export const mpesaWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.body;
    const io = req.app.get("io");

    // Log the full payload for debugging
    console.log('===== M-PESA WEBHOOK RECEIVED =====');
    console.log('Full payload:', JSON.stringify(payload, null, 2));
    console.log('Body.stkCallback:', JSON.stringify(payload?.Body?.stkCallback, null, 2));
    console.log('====================================')

    if (payload?.Body?.stkCallback) {
      io?.emit("callback.received", {
        message: payload?.Body?.stkCallback.ResultDesc,
        code: payload?.Body?.stkCallback.ResultCode
      });
    }

    const parsed = parseCallback(payload);

    
    if (!parsed.valid || !parsed.checkoutRequestId) {
      res.status(200).json({ success: false });
      return;
    }

    const payment = await Payment.findOne({ "processorRefs.daraja.checkoutRequestId": parsed.checkoutRequestId });
    if (!payment) {
      res.status(200).json({ success: false });
      return;
    }

    if (!parsed.success) {
      payment.status = "FAILED";
      await payment.save();
      if (io) io.emit("payment.updated", { paymentId: payment._id, status: "FAILED" });
      res.status(200).json({ success: true });
      return;
    }

    payment.transactionRef = parsed.transactionRef;
    await applySuccessfulPayment(payment, io);
    
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('M-Pesa Webhook Error:', error);
    res.status(200).json({ success: false }); // Always return 200 to Safaricom
  }
};

/**
 * Check payment status by checkoutRequestId and update locally.
 */
export const checkPaymentStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { checkoutRequestId } = req.params;
    
    if (!checkoutRequestId || typeof checkoutRequestId !== "string") {
      return next(errorHandler(400, "checkoutRequestId is required"));
    }

    const payment = await Payment.findOne({ "processorRefs.daraja.checkoutRequestId": checkoutRequestId });
    if (!payment) return next(errorHandler(404, "Payment record not found"));

    const statusResult = await queryStkPushStatus(checkoutRequestId as string);

    if (statusResult.ok) {
      const io = req.app.get("io");
      const resultCode = String(statusResult.resultCode);
      
      if (resultCode === "0") {
        if (payment.status !== "SUCCESS") {
          await applySuccessfulPayment(payment, io);
        }
      } else if (payment.status === "PENDING") {
        payment.status = "FAILED";
        await payment.save();
        if (io) io.emit("payment.updated", { paymentId: payment._id, status: "FAILED" });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        payment,
        status: statusResult
      }
    });
  } catch (error: any) {
    next(errorHandler(500, `Error checking payment status: ${error.message}`));
  }
};

/**
 * Get all payments (Admin/Staff only).
 */
export const getPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const { status, method } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (method) query.method = method;

    const total = await Payment.countDocuments(query);
    const payments = await Payment.find(query)
      .populate("memberId", "name email phone")
      .populate("contributionId")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, `Error fetching payments: ${error.message}`));
  }
};

/**
 * Get payments for the authenticated member.
 */
export const getMemberPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const memberId = req.user?._id;

    const query: any = { memberId };

    const total = await Payment.countDocuments(query);
    const payments = await Payment.find(query)
      .populate("contributionId")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error: any) {
    next(errorHandler(500, `Error fetching your payments: ${error.message}`));
  }
};

/**
 * Get a single payment by ID.
 */
export const getPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate("memberId", "name email phone")
      .populate("contributionId");

    if (!payment) return next(errorHandler(404, "Payment not found"));

    // Access control
    const isOwner = payment.memberId?._id?.toString() === req.user?._id.toString();
    const isLeader = ["chairman", "treasurer", "secretary"].some(role => req.roles?.includes(role));

    if (!isOwner && !isLeader) {
      return next(errorHandler(403, "Access denied"));
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error: any) {
    next(errorHandler(500, `Error fetching payment: ${error.message}`));
  }
};

/**
 * Delete a payment record.
 * Complete payments cannot be deleted.
 */
export const deletePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return next(errorHandler(404, "Payment not found"));

    if (payment.status === "SUCCESS") {
      return next(errorHandler(400, "Cannot delete a successful payment"));
    }

    // Access control
    const isOwner = payment.memberId?.toString() === req.user?._id.toString();
    const isLeader = ["chairman", "treasurer", "secretary"].some(role => req.roles?.includes(role));

    if (!isOwner && !isLeader) {
      return next(errorHandler(403, "Access denied"));
    }

    await Payment.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Payment record deleted successfully"
    });
  } catch (error: any) {
    next(errorHandler(500, `Error deleting payment: ${error.message}`));
  }
};
