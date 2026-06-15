// uplift-backend/models/DmRequest.js
const mongoose = require('mongoose');

const DmRequestSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  recipient: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' }
}, { timestamps: true });

// Prevent duplicate pending or accepted requests between the same users
DmRequestSchema.index({ sender: 1, recipient: 1 }, { unique: true });

module.exports = mongoose.model('DmRequest', DmRequestSchema);
