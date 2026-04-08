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
 * @route   GET /api/analytics/chairman
 * @desc    Get system growth and activity (Chairman only)
 * @access  Private (Chairman)
 */
router.get('/chairman', authorizeRoles(['chairman']), getChairmanAnalytics);

/**
 * @route   GET /api/analytics/treasurer
 * @desc    Get financial health and collection efficiency (Treasurer and Chairman)
 * @access  Private (Treasurer, Chairman)
 */
router.get('/treasurer', authorizeRoles(['treasurer', 'chairman']), getTreasurerAnalytics);

/**
 * @route   GET /api/analytics/member
 * @desc    Get personal contribution and savings progress (All members)
 * @access  Private (Member)
 */
router.get('/member', getMemberAnalytics);

export default router;
