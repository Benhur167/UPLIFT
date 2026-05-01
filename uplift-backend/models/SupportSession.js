const mongoose = require('mongoose');

const SupportSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  userAvatar: String,
  status: { type: String, default: 'open' },
  requestedCall: { phone: String, preferredAt: Date, status: String },
  bookings: [{ psychiatristId: String, slotStart: Date, slotEnd: Date, status: String }]
}, { timestamps: true });

module.exports = mongoose.model('SupportSession', SupportSessionSchema);
