// models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: [
      'mentorship_request', 'mentorship_accepted', 'mentorship_declined', 'mentorship_completed',
      'job_posted', 'event_approved', 'notice_posted',
      'message_received', 'badge_earned', 'match_found',
      'resume_analyzed', 'application_received',
    ],
    required: true,
  },
  title: { type: String, required: true },
  body: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed }, // Extra payload (jobId, chatId, etc.)
  isRead: { type: Boolean, default: false },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Who triggered it
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
