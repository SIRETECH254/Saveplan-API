import express from 'express';
import {
    getLeaderDashboard,
    getMemberDashboard,
    getFinancialStats
} from '../controllers/dashboardController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

/**
 * @route   GET /api/dashboard/leader
 * @desc    Get administrative dashboard statistics for leaders
 * @access  Private (Chairman, Treasurer, Secretary)
 */
router.get('/leader', authenticateToken, authorizeRoles(['chairman', 'treasurer', 'secretary']), getLeaderDashboard);

/**
 * @route   GET /api/dashboard/member
 * @desc    Get member dashboard statistics
 * @access  Private (Member)
 */
router.get('/member', authenticateToken, getMemberDashboard);

/**
 * @route   GET /api/dashboard/financials
 * @desc    Get in-depth financial analytics
 * @access  Private (Chairman, Treasurer)
 */
router.get('/financials', authenticateToken, authorizeRoles(['chairman', 'treasurer']), getFinancialStats);

export default router;
