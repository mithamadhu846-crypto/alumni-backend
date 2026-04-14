// routes/chatbot.js
const express = require('express');
const router = express.Router();
const { sendMessage, analyzeResume, getCareerInsights } = require('../controllers/chatbotController');
const { protect } = require('../middleware/auth');

router.post('/message', protect, sendMessage);
router.post('/resume-analyze', protect, analyzeResume);
router.get('/career-insights', protect, getCareerInsights);

module.exports = router;
