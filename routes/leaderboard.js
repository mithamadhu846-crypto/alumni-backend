// routes/leaderboard.js
const express = require('express');
const leaderboardRouter = express.Router();
const { getLeaderboard } = require('../controllers/leaderboardController');
const { protect } = require('../middleware/auth');
leaderboardRouter.get('/', protect, getLeaderboard);
module.exports = leaderboardRouter;
