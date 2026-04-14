// routes/career.js
const express = require('express');
const router = express.Router();
const { getCareerRoadmap } = require('../controllers/careerController');
const { protect } = require('../middleware/auth');
router.get('/roadmap', protect, getCareerRoadmap);
module.exports = router;
