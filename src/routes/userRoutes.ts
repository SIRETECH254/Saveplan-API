import express from "express";
import {
  updateUserProfile,
  changePassword,
  getAllUsers,
  getUserById,
  deleteMembers,
  updateMemberStatus
} from "../controllers/userController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = express.Router();

/**
 * @swagger
 * /api/users/update-profile:
 *   put:
 *     summary: Update own member profile
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               phone: { type: string }
 *               notificationPreferences:
 *                 type: object
 *                 properties:
 *                   email: { type: boolean }
 *                   sms: { type: boolean }
 *                   contributionAlerts: { type: boolean }
 *                   payoutUpdates: { type: boolean }
 *     responses:
 *       200: { description: Profile updated }
 */
router.put("/update-profile", authenticateToken, updateUserProfile);

/**
 * @swagger
 * /api/users/change-password:
 *   put:
 *     summary: Change own password
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200: { description: Password changed }
 */
router.put("/change-password", authenticateToken, changePassword);

/**
 * @swagger
 * /api/users/oversight:
 *   get:
 *     summary: Get overview of all family members (Chairman/Secretary)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Member list }
 */
router.get("/oversight", authenticateToken, authorizeRoles(["chairman", "secretary"]), getAllUsers);

/**
 * @swagger
 * /api/users/{userId}:
 *   get:
 *     summary: Get detailed profile of a specific member (Chairman/Secretary)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: User details }
 */
router.get("/:userId", authenticateToken, authorizeRoles(["chairman", "secretary"]), getUserById);

/**
 * @swagger
 * /api/users/{userId}/status:
 *   put:
 *     summary: Activate or deactivate a member (Admin/Chairman)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean }
 *     responses:
 *       200: { description: Status updated }
 */
router.put("/:userId/status", authenticateToken, authorizeRoles(["chairman", "secretary"]), updateMemberStatus);

/**
 * @swagger
 * /api/users/{userId}:
 *   delete:
 *     summary: Delete a member account (Chairman)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Member deleted }
 */
router.delete("/:userId", authenticateToken, authorizeRoles(["chairman"]), deleteMembers);

export default router;
