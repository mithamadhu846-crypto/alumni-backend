// models/Chat.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true },
  type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
});

const chatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  messages: [messageSchema],
  lastMessage: {
    content: String,
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: Date,
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

chatSchema.index({ participants: 1 });
chatSchema.index({ 'lastMessage.at': -1 });

module.exports = mongoose.model('Chat', chatSchema);
