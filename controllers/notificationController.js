// controllers/notificationController.js
const Notification = require('../models/Notification');

// Helper to create + emit a notification
exports.createNotification = async (io, { recipientId, type, title, body, data, actorId }) => {
  try {
    const notif = await Notification.create({
      recipient: recipientId,
      type, title, body, data,
      actor: actorId || null,
    });
    // Push to recipient's socket room
    if (io) {
      io.to(`user_${recipientId}`).emit('notification', {
        id: notif._id, type, title, body, data,
        createdAt: notif.createdAt,
      });
    }
    return notif;
  } catch (err) {
    console.error('Notification create error:', err);
  }
};

// GET /api/notifications
exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('actor', 'name avatar role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });

    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch notifications.' });
  }
};

// PATCH /api/notifications/:id/read
exports.markRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true }
    );
    res.json({ message: 'Marked as read.' });
  } catch {
    res.status(500).json({ error: 'Could not update.' });
  }
};

// PATCH /api/notifications/read-all
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
    res.json({ message: 'All notifications marked as read.' });
  } catch {
    res.status(500).json({ error: 'Could not update.' });
  }
};
