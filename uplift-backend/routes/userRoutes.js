// uplift-backend/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// POST /api/users/signup
router.post('/signup', async (req, res) => {
  try {
    const { username, password, avatar } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'username and password required' });

    // check existing
    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ message: 'username taken' });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const user = await User.create({ username, passwordHash: hash, avatar });
    // return minimal public info
    res.status(201).json({ _id: user._id, username: user.username, avatar: user.avatar });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'failed to create user' });
  }
});

// POST /api/users/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'username and password required' });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'invalid credentials' });

    res.json({ _id: user._id, username: user.username, avatar: user.avatar });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'login failed' });
  }
});

module.exports = router;  