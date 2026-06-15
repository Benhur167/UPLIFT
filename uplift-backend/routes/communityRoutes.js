// uplift-backend/routes/communityRoutes.js
const express = require('express');
const router = express.Router();
const Community = require('../models/Community');
const Message = require('../models/Message');
const authCheck = require('../middleware/authCheck');

// Create a new community (protected)
router.post('/', authCheck, async (req, res) => {
  try {
    const { name, description, rules = [] } = req.body;
    const createdBy = req.user.username; // Use authenticated user

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Community name is required' });
    }

    const community = await Community.create({
      name: name.trim(),
      description: description || "",
      rules,
      creator: createdBy,
      admins: [createdBy],
      members: [createdBy], // Creator joins automatically
      memberJoins: [{ username: createdBy, joinedAt: new Date() }]
    });

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
    const normalized = list.map(c => ({
      ...c,
      members: c.members || [],
      admins: c.admins || [],
      creator: c.creator || 'anonymous'
    }));
    res.json(normalized);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'failed to fetch communities' });
  }
});

// Get single community by id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const comm = await Community.findById(id).lean();
    if (!comm) return res.status(404).json({ message: 'community not found' });
    comm.members = comm.members || [];
    comm.admins = comm.admins || [];
    comm.creator = comm.creator || 'anonymous';
    res.json(comm);
  } catch (e) {
    console.error('GET /communities/:id error', e);
    res.status(500).json({ message: 'failed to fetch community' });
  }
});

// Join a community (protected)
router.post('/:id/join', authCheck, async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.user.username;
    const comm = await Community.findById(id);
    if (!comm) return res.status(404).json({ message: 'community not found' });

    if (!comm.members) comm.members = [];
    let isNewJoin = false;

    if (!comm.members.includes(username)) {
      comm.members.push(username);
      if (!comm.memberJoins) comm.memberJoins = [];
      comm.memberJoins = comm.memberJoins.filter(mj => mj.username !== username);
      comm.memberJoins.push({ username, joinedAt: new Date() });
      await comm.save();
      isNewJoin = true;
    }

    if (isNewJoin) {
      const io = req.app.get('io');
      if (io) {
        io.to(id).emit('communityUpdated', { roomId: id, members: comm.members, membersCount: comm.members.length });
        
        // Save and broadcast system message
        const sysMsg = await Message.create({
          roomId: id,
          sender: 'system',
          text: `${username} joined the community`
        });
        io.to(id).emit('chatMessage', sysMsg);
      }
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

// Promote a member to admin (protected)
router.post('/:id/promote', authCheck, async (req, res) => {
  try {
    const { id } = req.params;
    const { username: targetUsername } = req.body;
    const requestingUser = req.user.username;

    if (!targetUsername) return res.status(400).json({ message: 'Username to promote is required' });

    const comm = await Community.findById(id);
    if (!comm) return res.status(404).json({ message: 'Community not found' });

    // Verify requesting user is admin
    if (!comm.admins.includes(requestingUser)) {
      return res.status(403).json({ message: 'Only admins can promote other members' });
    }

    // Add to admins if not already there
    if (!comm.admins.includes(targetUsername)) {
      comm.admins.push(targetUsername);
      // Ensure they are also in the members list
      if (!comm.members.includes(targetUsername)) {
        comm.members.push(targetUsername);
      }
      await comm.save();

      const io = req.app.get('io');
      if (io) {
        io.to(id).emit('memberPromoted', { roomId: id, username: targetUsername });
        io.to(id).emit('communityUpdated', { roomId: id, members: comm.members, membersCount: comm.members.length });
        
        // Save and broadcast system message
        const sysMsg = await Message.create({
          roomId: id,
          sender: 'system',
          text: `${targetUsername} was promoted to admin`
        });
        io.to(id).emit('chatMessage', sysMsg);
      }
    }

    return res.status(200).json({ success: true, admins: comm.admins });
  } catch (e) {
    console.error('POST /communities/:id/promote error', e);
    return res.status(500).json({ message: 'failed to promote member' });
  }
});

// Kick/Remove a member from the community (protected)
router.post('/:id/kick', authCheck, async (req, res) => {
  try {
    const { id } = req.params;
    const { username: targetUsername } = req.body;
    const requestingUser = req.user.username;

    if (!targetUsername) return res.status(400).json({ message: 'Username to kick is required' });
    if (targetUsername === requestingUser) return res.status(400).json({ message: 'You cannot kick yourself' });

    const comm = await Community.findById(id);
    if (!comm) return res.status(404).json({ message: 'Community not found' });

    // Verify requesting user is admin
    if (!comm.admins.includes(requestingUser)) {
      return res.status(403).json({ message: 'Only admins can kick members' });
    }

    // Prevent kicking the creator
    if (comm.creator === targetUsername) {
      return res.status(403).json({ message: 'The community creator cannot be kicked' });
    }

    // Remove target from members and admins
    comm.members = comm.members.filter(m => m !== targetUsername);
    comm.admins = comm.admins.filter(a => a !== targetUsername);
    if (comm.memberJoins) {
      comm.memberJoins = comm.memberJoins.filter(mj => mj.username !== targetUsername);
    }
    await comm.save();

    const io = req.app.get('io');
    if (io) {
      io.to(id).emit('memberKicked', { roomId: id, username: targetUsername });
      io.to(id).emit('communityUpdated', { roomId: id, members: comm.members, membersCount: comm.members.length });
      
      // Save and broadcast system message
      const sysMsg = await Message.create({
        roomId: id,
        sender: 'system',
        text: `${targetUsername} was removed from the community`
      });
      io.to(id).emit('chatMessage', sysMsg);
    }

    return res.status(200).json({ success: true, members: comm.members });
  } catch (e) {
    console.error('POST /communities/:id/kick error', e);
    return res.status(500).json({ message: 'failed to kick member' });
  }
});

// Leave a community (protected)
router.post('/:id/leave', authCheck, async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.user.username;

    const comm = await Community.findById(id);
    if (!comm) return res.status(404).json({ message: 'Community not found' });

    // Remove from members and admins
    comm.members = comm.members.filter(m => m !== username);
    comm.admins = comm.admins.filter(a => a !== username);
    if (comm.memberJoins) {
      comm.memberJoins = comm.memberJoins.filter(mj => mj.username !== username);
    }
    await comm.save();

    const io = req.app.get('io');
    if (io) {
      io.to(id).emit('communityUpdated', { roomId: id, members: comm.members, membersCount: comm.members.length });
      
      // Save and broadcast system message
      const sysMsg = await Message.create({
        roomId: id,
        sender: 'system',
        text: `${username} left the community`
      });
      io.to(id).emit('chatMessage', sysMsg);
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('POST /communities/:id/leave error', e);
    return res.status(500).json({ message: 'failed to leave community' });
  }
});

module.exports = router;
