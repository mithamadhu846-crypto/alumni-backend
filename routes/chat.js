// routes/chat.js
const express = require('express');
const router = express.Router();
const { getConversations, getOrCreateChat, getMessages, sendMessage } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

router.get('/conversations', protect, getConversations);
router.get('/with/:userId', protect, getOrCreateChat);
router.get('/:chatId/messages', protect, getMessages);
router.post('/:chatId/messages', protect, sendMessage);

module.exports = router;
