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
 * @swagger
 * /api/payments/initiate:
 *   post:
 *     summary: Member initiates their own contribution payment
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contributionIds, amount, phone]
 *             properties:
 *               contributionIds: { type: array, items: { type: string } }
 *               amount: { type: number }
 *               phone: { type: string }
 *     responses:
 *       200: { description: STK push initiated }
 */
router.post("/initiate", authenticateToken, initiateContributions);

/**
 * @swagger
 * /api/payments/initiate-admin:
 *   post:
 *     summary: Admin initiates payment for a member
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [memberId, amount, method]
 *             properties:
 *               memberId: { type: string }
 *               contributionIds: { type: array, items: { type: string } }
 *               amount: { type: number }
 *               method: { type: string, enum: [MPESA, CASH] }
 *     responses:
 *       200: { description: Payment record created/STK initiated }
 */
router.post("/initiate-admin", authenticateToken, authorizeRoles(["chairman", "treasurer"]), initiateContributionAdmin);

/**
 * @swagger
 * /api/payments/webhooks/mpesa:
 *   post:
 *     summary: M-Pesa Callback (Public)
 *     tags: [Payments]
 *     responses:
 *       200: { description: Webhook processed }
 */
router.post("/webhooks/mpesa", mpesaWebhook);

/**
 * @swagger
 * /api/payments/status/{checkoutRequestId}:
 *   get:
 *     summary: Check M-Pesa STK push status manually
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: checkoutRequestId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Status details }
 */
router.get("/status/:checkoutRequestId", authenticateToken, checkPaymentStatus);

/**
 * @swagger
 * /api/payments/my-payments:
 *   get:
 *     summary: Get authenticated member's payments
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Member payment history }
 */
router.get("/my-payments", authenticateToken, getMemberPayments);

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Get all payments (Admin oversight)
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200: { description: Payment list }
 */
router.get("/", authenticateToken, authorizeRoles(["chairman", "treasurer", "secretary"]), getPayments);

/**
 * @swagger
 * /api/payments/{id}:
 *   get:
 *     summary: Get single payment details
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Payment details }
 */
router.get("/:id", authenticateToken, getPayment);

/**
 * @swagger
 * /api/payments/{id}:
 *   delete:
 *     summary: Delete pending/failed payment record
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted successfully }
 */
router.delete("/:id", authenticateToken, deletePayment);

export default router;
