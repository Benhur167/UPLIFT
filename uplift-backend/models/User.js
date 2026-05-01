// uplift-backend/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }, // decoy name
  passwordHash: { type: String, required: true },
  avatar: { type: String, default: '/default-avatar.png' }, // file name or data URL
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
