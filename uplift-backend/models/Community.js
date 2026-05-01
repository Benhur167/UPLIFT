// uplift-backend/models/Community.js
const mongoose = require('mongoose');

const CommunitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: "" },
  rules: { type: [String], default: [] },
  avatar: { type: String, default: null },
  members: { type: [String], default: [] }, // store usernames for simplicity
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Community', CommunitySchema);
