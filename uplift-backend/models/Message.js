// uplift-backend/models/Message.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const MessageSchema = new Schema({
  roomId: { type: String, required: true },
  sender: { type: String, default: 'anonymous' },
  avatar: { type: String, default: null },
  text: { type: String, required: true },
  seenBy: { type: [String], default: [] },
  blockedFor: { type: String, default: null },
}, { timestamps: true });
module.exports = mongoose.model('Message', MessageSchema);
