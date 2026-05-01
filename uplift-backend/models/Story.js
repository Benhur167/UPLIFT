// uplift-backend/models/Story.js
const mongoose = require('mongoose');

const StorySchema = new mongoose.Schema(
  {
    username: { type: String, default: 'anonymous' },
    title: { type: String, default: '' },
    content: { type: String, required: true },
    tags: { type: [String], default: [] },
    type: { type: String, enum: ['problem', 'success'], default: 'problem' },

  },
  { timestamps: true }
);

// Enable Mongo text search
StorySchema.index({ title: 'text', content: 'text', tags: 'text' });

module.exports = mongoose.model('Story', StorySchema);
