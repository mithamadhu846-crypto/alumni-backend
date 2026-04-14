const express = require('express');
const router = express.Router();
const { createNotice, getNotices, markRead } = require('../controllers/noticeController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getNotices);
router.post('/', protect, authorize('admin', 'faculty'), createNotice);
router.patch('/:id/read', protect, markRead);

module.exports = router;
