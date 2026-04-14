const express = require('express');
const router = express.Router();
const { createEvent, getEvents, registerForEvent, approveEvent } = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getEvents);
router.post('/', protect, createEvent);
router.post('/:id/register', protect, registerForEvent);
router.patch('/:id/approve', protect, authorize('admin'), approveEvent);

module.exports = router;
