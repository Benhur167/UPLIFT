// models/SupportRequest.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const SupportRequestSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  userEmail: String,
  status: { type: String, enum: ['open','in_progress','resolved'], default: 'open' },
  createdAt: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' } // admin id
});
module.exports = mongoose.model('SupportRequest', SupportRequestSchema);
