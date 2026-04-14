// routes/analytics.js
const express = require('express');
const analyticsRouter = express.Router();
const { getDashboardStats, getEngagementStats } = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');
analyticsRouter.get('/dashboard', protect, authorize('admin'), getDashboardStats);
analyticsRouter.get('/engagement', protect, authorize('admin'), getEngagementStats);
module.exports = analyticsRouter;
