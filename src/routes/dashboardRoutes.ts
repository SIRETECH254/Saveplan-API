import express from 'express';
import {
    getLeaderDashboard,
    getMemberDashboard,
    getFinancialStats
} from '../controllers/dashboardController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /api/dashboard/leader:
 *   get:
 *     summary: Get administrative dashboard statistics for leaders
 *     tags: [Stats]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Dashboard data for Chairman, Treasurer, and Secretary
 */
router.get('/leader', authenticateToken, authorizeRoles(['chairman', 'treasurer', 'secretary']), getLeaderDashboard);

/**
 * @swagger
 * /api/dashboard/member:
 *   get:
 *     summary: Get member dashboard statistics
 *     tags: [Stats]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Personal dashboard data for the authenticated member
 */
router.get('/member', authenticateToken, getMemberDashboard);

/**
 * @swagger
 * /api/dashboard/financials:
 *   get:
 *     summary: Get in-depth financial analytics
 *     tags: [Stats]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Financial analytics data for Chairman and Treasurer
 */
router.get('/financials', authenticateToken, authorizeRoles(['chairman', 'treasurer']), getFinancialStats);

export default router;
