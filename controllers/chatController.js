// controllers/chatController.js
const Chat = require('../models/Chat');
const User = require('../models/User');

// Get all conversations for current user
exports.getConversations = async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user._id,
      isActive: true,
    })
      .populate('participants', 'name avatar role currentRole isActive')
      .sort({ 'lastMessage.at': -1 })
      .limit(50);

    // Format: other participant + last message + unread count
    const formatted = chats.map(chat => {
      const other = chat.participants.find(p => p._id.toString() !== req.user._id.toString());
      const unread = chat.messages.filter(
        m => m.sender.toString() !== req.user._id.toString() && !m.readBy.includes(req.user._id)
      ).length;
      return {
        chatId: chat._id,
        participant: other,
        lastMessage: chat.lastMessage,
        unreadCount: unread,
      };
    });

    res.json({ conversations: formatted });
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch conversations.' });
  }
};

// Get or create chat between two users
exports.getOrCreateChat = async (req, res) => {
  try {
    const { userId } = req.params;
    const myId = req.user._id;

    if (userId === myId.toString()) {
      return res.status(400).json({ error: 'Cannot chat with yourself.' });
    }

    const other = await User.findById(userId);
    if (!other) return res.status(404).json({ error: 'User not found.' });

    // Find existing chat
    let chat = await Chat.findOne({
      participants: { $all: [myId, userId] },
    }).populate('participants', 'name avatar role currentRole');

    if (!chat) {
      chat = await Chat.create({ participants: [myId, userId], messages: [] });
      chat = await Chat.findById(chat._id).populate('participants', 'name avatar role currentRole');
    }

    res.json({ chat });
  } catch (error) {
    res.status(500).json({ error: 'Could not open chat.' });
  }
};

// Get messages for a chat
exports.getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id,
    }).populate('messages.sender', 'name avatar role');

    if (!chat) return res.status(404).json({ error: 'Chat not found.' });

    const total = chat.messages.length;
    const skip = Math.max(0, total - parseInt(page) * parseInt(limit));
    const messages = chat.messages.slice(skip, skip + parseInt(limit));

    // Mark messages as read
    await Chat.updateOne(
      { _id: chatId },
      { $addToSet: { 'messages.$[msg].readBy': req.user._id } },
      { arrayFilters: [{ 'msg.sender': { $ne: req.user._id } }] }
    );

    res.json({ messages, total, hasMore: skip > 0 });
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch messages.' });
  }
};

// Send a message (REST fallback — Socket.IO handles real-time)
exports.sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, type = 'text' } = req.body;

    if (!content?.trim()) return res.status(400).json({ error: 'Message content required.' });

    const chat = await Chat.findOne({ _id: chatId, participants: req.user._id });
    if (!chat) return res.status(404).json({ error: 'Chat not found.' });

    const newMessage = {
      sender: req.user._id,
      content: content.trim(),
      type,
      readBy: [req.user._id],
    };

    chat.messages.push(newMessage);
    chat.lastMessage = { content: content.trim(), sender: req.user._id, at: new Date() };
    await chat.save();

    const populatedMsg = chat.messages[chat.messages.length - 1];

    // Emit via Socket.IO
    const otherParticipant = chat.participants.find(p => p.toString() !== req.user._id.toString());
    if (req.io) {
      req.io.to(`user_${otherParticipant}`).emit('newMessage', {
        chatId,
        message: populatedMsg,
        from: { name: req.user.name, avatar: req.user.avatar },
      });
    }

    res.status(201).json({ message: populatedMsg });
  } catch (error) {
    res.status(500).json({ error: 'Could not send message.' });
  }
};
