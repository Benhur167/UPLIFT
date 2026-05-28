// uplift-backend/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }, // decoy name
  passwordHash: { type: String, required: true },
  avatar: { type: String, default: '/default-avatar.png' }, // file name or data URL
  email: { type: String, unique: true, sparse: true },      // email for OTP and Google login (sparse unique)
  role: { type: String, default: 'user', enum: ['user', 'admin'] }, // user or admin
  otp: {
    code: { type: String },
    expiresAt: { type: Date }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
