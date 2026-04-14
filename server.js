/**
 * Alumni App — Main Server
 * Express + MongoDB + Socket.IO (real-time chat + notifications)
 */
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');

// Routes
const authRoutes         = require('./routes/auth');
const userRoutes         = require('./routes/users');
const jobRoutes          = require('./routes/jobs');
const eventRoutes        = require('./routes/events');
const mentorshipRoutes   = require('./routes/mentorship');
const noticeRoutes       = require('./routes/notices');
const startupRoutes      = require('./routes/startups');
const chatbotRoutes      = require('./routes/chatbot');
const analyticsRoutes    = require('./routes/analytics');
const leaderboardRoutes  = require('./routes/leaderboard');
const careerRoutes       = require('./routes/career');
const chatRoutes         = require('./routes/chat');
const notificationRoutes = require('./routes/notifications');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] },
});

connectDB();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/', rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 200,
  message: { error: 'Too many requests, please try again later.' },
}));

app.use((req, res, next) => { req.io = io; next(); });

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/jobs',          jobRoutes);
app.use('/api/events',        eventRoutes);
app.use('/api/mentorship',    mentorshipRoutes);
app.use('/api/notices',       noticeRoutes);
app.use('/api/startups',      startupRoutes);
app.use('/api/chatbot',       chatbotRoutes);
app.use('/api/analytics',     analyticsRoutes);
app.use('/api/leaderboard',   leaderboardRoutes);
app.use('/api/career',        careerRoutes);
app.use('/api/chat',          chatRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));
app.use('*', (req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: process.env.NODE_ENV === 'production' ? 'Server error' : err.message });
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const onlineUsers = new Map(); // userId → socketId

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // Join personal room on auth
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    onlineUsers.set(userId, socket.id);
    io.emit('userOnline', { userId, online: true });
    console.log(`User ${userId} joined`);
  });

  // Join role broadcast room
  socket.on('joinRole', (role) => socket.join(`role_${role}`));

  // Join notice board
  socket.on('joinNoticeBoard', () => socket.join('notice_board'));

  // ─── Real-time Chat ────────────────────────────────────────────────────────
  socket.on('joinChat', (chatId) => socket.join(`chat_${chatId}`));

  socket.on('sendMessage', async ({ chatId, content, senderId, senderName, senderAvatar }) => {
    const message = {
      _id: Date.now().toString(),
      sender: { _id: senderId, name: senderName, avatar: senderAvatar },
      content,
      type: 'text',
      readBy: [senderId],
      createdAt: new Date(),
    };

    // Broadcast to everyone in the chat room
    io.to(`chat_${chatId}`).emit('messageReceived', { chatId, message });

    // Also update the chat in DB via the controller
    try {
      const Chat = require('./models/Chat');
      const chat = await Chat.findById(chatId);
      if (chat) {
        chat.messages.push({
          sender: senderId, content, type: 'text', readBy: [senderId],
        });
        chat.lastMessage = { content, sender: senderId, at: new Date() };
        await chat.save();
      }
    } catch (err) {
      console.error('Socket chat save error:', err.message);
    }
  });

  socket.on('typing', ({ chatId, userId, name }) => {
    socket.to(`chat_${chatId}`).emit('userTyping', { userId, name });
  });

  socket.on('stopTyping', ({ chatId, userId }) => {
    socket.to(`chat_${chatId}`).emit('userStopTyping', { userId });
  });

  socket.on('markRead', ({ chatId, userId }) => {
    socket.to(`chat_${chatId}`).emit('messagesRead', { chatId, userId });
  });

  // ─── Disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    for (const [userId, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(userId);
        io.emit('userOnline', { userId, online: false });
        break;
      }
    }
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// Export online users map for controllers
app.set('onlineUsers', onlineUsers);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║     AlumniConnect Server Running      ║
  ║  Port: ${PORT}  │  Env: ${(process.env.NODE_ENV || 'development').padEnd(12)}║
  ╚═══════════════════════════════════════╝
  `);
});

module.exports = { app, io };
