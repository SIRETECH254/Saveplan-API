import express from "express";
import {
  getAllRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  getMembersByRole,
  manageRoles
} from "../controllers/roleController";
import { authenticateToken, authorizeRoles } from "../middleware/auth";

const router = express.Router();

/**
 * @swagger
 * /api/admin/roles:
 *   get:
 *     summary: List all available system roles with pagination and search (Chairman)
 *     tags: [Admin]
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
 *     responses:
 *       200: { description: Role list }
 */
router.get("/roles", authenticateToken, authorizeRoles(["chairman"]), getAllRoles);

/**
 * @swagger
 * /api/admin/roles/{roleId}:
 *   get:
 *     summary: Fetch a specific role by ID (Chairman)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Role details }
 */
router.get("/roles/:roleId", authenticateToken, getRole);

/**
 * @swagger
 * /api/admin/roles:
 *   post:
 *     summary: Create a new system role (Chairman)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, description]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               permissions: { type: array, items: { type: string } }
 *     responses:
 *       201: { description: Role created }
 */
router.post("/roles", authenticateToken, authorizeRoles(["chairman"]), createRole);

/**
 * @swagger
 * /api/admin/roles/{roleId}:
 *   put:
 *     summary: Update role metadata or permissions (Chairman)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description: { type: string }
 *               permissions: { type: array, items: { type: string } }
 *               isActive: { type: boolean }
 *     responses:
 *       200: { description: Role updated }
 */
router.put("/roles/:roleId", authenticateToken, authorizeRoles(["chairman"]), updateRole);

/**
 * @swagger
 * /api/admin/roles/{roleId}:
 *   delete:
 *     summary: Delete a custom role (Chairman)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Role deleted }
 */
router.delete("/roles/:roleId", authenticateToken, authorizeRoles(["chairman"]), deleteRole);

/**
 * @swagger
 * /api/admin/roles/{roleId}/members:
 *   get:
 *     summary: Get all members assigned to a specific role with pagination (Chairman)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: Member list }
 */
router.get("/roles/:roleId/members", authenticateToken, authorizeRoles(["chairman"]), getMembersByRole);

/**
 * @swagger
 * /api/admin/manage-roles:
 *   post:
 *     summary: Assign roles to a member (Chairman)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, roleNames]
 *             properties:
 *               userId: { type: string }
 *               roleNames: { type: array, items: { type: string } }
 *     responses:
 *       200: { description: Roles updated }
 */
router.post("/manage-roles", authenticateToken, authorizeRoles(["chairman"]), manageRoles);

export default router;
