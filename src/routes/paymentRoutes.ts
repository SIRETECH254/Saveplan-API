import express from "express";
import {
  initiateContributions,
  initiateContributionAdmin,
  mpesaWebhook,
  checkPaymentStatus,
  getPayments,
  getMemberPayments,
  getPayment,
  deletePayment
} from "../controllers/paymentController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = express.Router();

/**
 * @route POST /api/payments/initiate
 * @desc Member initiates their own contribution payment
 */
router.post("/initiate", authenticateToken, initiateContributions);

/**
 * @route POST /api/payments/initiate-admin
 * @desc Admin initiates payment for a member
 */
router.post("/initiate-admin", authenticateToken, authorizeRoles(["chairman", "treasurer"]), initiateContributionAdmin);

/**
 * @route POST /api/payments/webhooks/mpesa
 * @desc M-Pesa Callback (Public)
 */
router.post("/webhooks/mpesa", mpesaWebhook);

/**
 * @route GET /api/payments/status/:checkoutRequestId
 * @desc Check M-Pesa STK push status manually
 */
router.get("/status/:checkoutRequestId", authenticateToken, checkPaymentStatus);

/**
 * @route GET /api/payments/my-payments
 * @desc Get authenticated member's payments
 */
router.get("/my-payments", authenticateToken, getMemberPayments);

/**
 * @route GET /api/payments/
 * @desc Get all payments (Admin oversight)
 */
router.get("/", authenticateToken, authorizeRoles(["chairman", "treasurer", "secretary"]), getPayments);

/**
 * @route GET /api/payments/:id
 * @desc Get single payment details
 */
router.get("/:id", authenticateToken, getPayment);

/**
 * @route DELETE /api/payments/:id
 * @desc Delete pending/failed payment record
 */
router.delete("/:id", authenticateToken, deletePayment);

export default router;
