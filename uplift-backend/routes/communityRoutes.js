// uplift-backend/routes/communityRoutes.js
const express = require('express');
const router = express.Router();
const Community = require('../models/Community');
const authCheck = require('../middleware/authCheck');

// Create a new community
router.post('/', async (req, res) => {
  try {
    const { name, description, rules = [], createdBy = 'anonymous' } = req.body;
    const community = await Community.create({ name, description, rules, createdBy });
    res.status(201).json(community);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'failed to create community' });
  }
});

// Get all communities
router.get('/', async (_req, res) => {
  try {
    const list = await Community.find().sort({ createdAt: -1 }).limit(200).lean();
    const normalized = list.map(c => ({ ...c, members: c.members || [] }));
    res.json(normalized);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'failed to fetch communities' });
  }
});

// NEW: Get single community by id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const comm = await Community.findById(id).lean();
    if (!comm) return res.status(404).json({ message: 'community not found' });
    comm.members = comm.members || [];
    res.json(comm);
  } catch (e) {
    console.error('GET /communities/:id error', e);
    res.status(500).json({ message: 'failed to fetch community' });
  }
});

// Join a community (protected)
// POST /api/communities/:id/join  (protected)
router.post('/:id/join', authCheck, async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.user.username;
    const comm = await Community.findById(id);
    if (!comm) return res.status(404).json({ message: 'community not found' });

    if (!comm.members) comm.members = [];
    if (!comm.members.includes(username)) {
      comm.members.push(username);
      await comm.save();
    }

    return res.status(200).json({
      success: true,
      membersCount: comm.members.length,
      members: comm.members
    });
  } catch (e) {
    console.error('POST /communities/:id/join error', e);
    return res.status(500).json({ message: 'failed to join community' });
  }
});

module.exports = router;
