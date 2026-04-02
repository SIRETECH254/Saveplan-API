import express from "express";
import {
  generateInvitation,
  getInvitations,
  getInvitationById,
  updateInvitation,
  deleteInvitation
} from "../controllers/invitationCodeController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = express.Router();

// All invitation routes require authentication and chairman-level permissions
router.use(authenticateToken);
router.use(authorizeRoles(["chairman"]));

/**
 * @swagger
 * /api/invitations:
 *   post:
 *     summary: Generate a new invitation code
 *     tags: [Invitations]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expiresAt: { type: string, format: date-time }
 *     responses:
 *       201: { description: Created }
 */
router.post("/", generateInvitation);

/**
 * @swagger
 * /api/invitations:
 *   get:
 *     summary: Get all invitation codes (with pagination and search)
 *     tags: [Invitations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: isUsed
 *         schema: { type: boolean }
 *     responses:
 *       200: { description: Success }
 */
router.get("/", getInvitations);

/**
 * @swagger
 * /api/invitations/{id}:
 *   get:
 *     summary: Get invitation details by ID
 *     tags: [Invitations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Success }
 */
router.get("/:id", getInvitationById);

/**
 * @swagger
 * /api/invitations/{id}:
 *   patch:
 *     summary: Update invitation code metadata
 *     tags: [Invitations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expiresAt: { type: string, format: date-time }
 *               isUsed: { type: boolean }
 *     responses:
 *       200: { description: Success }
 */
router.patch("/:id", updateInvitation);

/**
 * @swagger
 * /api/invitations/{id}:
 *   delete:
 *     summary: Delete an unused invitation code
 *     tags: [Invitations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 */
router.delete("/:id", deleteInvitation);

export default router;
