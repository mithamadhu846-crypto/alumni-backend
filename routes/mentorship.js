// mentorship.js
const express = require('express');
const mentorshipRouter = express.Router();
const {
  requestMentorship, getMentorships, updateMentorshipStatus, submitReview,
} = require('../controllers/mentorshipController');
const { protect } = require('../middleware/auth');

mentorshipRouter.get('/', protect, getMentorships);
mentorshipRouter.post('/', protect, requestMentorship);
mentorshipRouter.patch('/:id/status', protect, updateMentorshipStatus);
mentorshipRouter.post('/:id/review', protect, submitReview);

module.exports = mentorshipRouter;
