import express from "express";
import {
  createContribution,
  getContributions,
  getMyContributions,
  getContribution,
  deleteContribution
} from "../controllers/contributionController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = express.Router();

/**
 * All routes require authentication.
 */
router.use(authenticateToken);

/**
 * @swagger
 * /api/contributions:
 *   post:
 *     summary: Create a new contribution record
 *     tags: [Contributions]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { type: number }
 *               notes: { type: string }
 *               memberId: { type: string }
 *     responses:
 *       201: { description: Created }
 */
router.post("/", createContribution);

/**
 * @swagger
 * /api/contributions:
 *   get:
 *     summary: Get all contributions (Admin oversight)
 *     tags: [Contributions]
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
 *       - in: query
 *         name: memberId
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of contributions }
 */
router.get("/", authorizeRoles(["chairman", "treasurer", "secretary"]), getContributions);

/**
 * @swagger
 * /api/contributions/my-contributions:
 *   get:
 *     summary: Get contributions for the current member
 *     tags: [Contributions]
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
 *       200: { description: List of your contributions }
 */
router.get("/my-contributions", getMyContributions);

/**
 * @swagger
 * /api/contributions/{id}:
 *   get:
 *     summary: Get details of a specific contribution
 *     tags: [Contributions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Contribution details }
 */
router.get("/:id", getContribution);

/**
 * @swagger
 * /api/contributions/{id}:
 *   delete:
 *     summary: Delete a pending/cancelled contribution
 *     tags: [Contributions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted successfully }
 */
router.delete("/:id", deleteContribution);

export default router;
