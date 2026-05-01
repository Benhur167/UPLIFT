// uplift-backend/models/SupportMessage.js
const mongoose = require('mongoose');

const SupportMessageSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportSession', required: true },
  senderType: { type: String, enum: ['user','admin','system'], default: 'user' },
  senderId: { type: String }, // optional (user id or admin id)
  senderName: { type: String, required: true },
  senderAvatar: { type: String, default: null },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SupportMessage', SupportMessageSchema);
