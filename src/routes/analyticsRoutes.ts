import express from 'express';
import {
    getChairmanAnalytics,
    getTreasurerAnalytics,
    getMemberAnalytics
} from '../controllers/analyticsController';
import { authenticateToken, authorizeRoles, checkMemberStatus } from '../middleware/auth';

const router = express.Router();

// All analytics routes require authentication and verified member status
router.use(authenticateToken);
router.use(checkMemberStatus);

/**
 * @swagger
 * /api/analytics/chairman:
 *   get:
 *     summary: Get system growth and activity (Chairman only)
 *     tags: [Stats]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7d, 14d, 28d, 3m, 6m, 1y]
 *           default: 7d
 *     responses:
 *       200:
 *         description: Member growth and system activity metrics
 */
router.get('/chairman', authorizeRoles(['chairman']), getChairmanAnalytics);

/**
 * @swagger
 * /api/analytics/treasurer:
 *   get:
 *     summary: Get financial health and collection efficiency (Treasurer and Chairman)
 *     tags: [Stats]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7d, 14d, 28d, 3m, 6m, 1y]
 *           default: 7d
 *     responses:
 *       200:
 *         description: Financial trends, efficiency, and payment distribution
 */
router.get('/treasurer', authorizeRoles(['treasurer', 'chairman']), getTreasurerAnalytics);

/**
 * @swagger
 * /api/analytics/member:
 *   get:
 *     summary: Get personal contribution and savings progress (All members)
 *     tags: [Stats]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [7d, 14d, 28d, 3m, 6m, 1y]
 *           default: 7d
 *     responses:
 *       200:
 *         description: Personal savings and consistency score data
 */
router.get('/member', getMemberAnalytics);

export default router;
