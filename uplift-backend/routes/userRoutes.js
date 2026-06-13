// uplift-backend/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const authCheck = require('../middleware/authCheck');

// Helper to send email (strict SMTP)
async function sendOTPEmail(email, otpCode) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP credentials are missing on the server. Cannot send OTP.');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: '"Uplift Support" <no-reply@uplift-emotional-support.org>',
    to: email,
    subject: "Uplift Password Reset OTP Code",
    text: `Your OTP code for password reset is: ${otpCode}. It expires in 10 minutes.`,
    html: `<p>Your OTP code for password reset is: <b>${otpCode}</b></p><p>It will expire in 10 minutes.</p>`
  });
  console.log('OTP Email sent successfully via SMTP');
}

// POST /api/users/signup
router.post('/signup', async (req, res) => {
  try {
    const { username, password, avatar, email } = req.body;
    if (!username || !password || !email) return res.status(400).json({ message: 'username, password and email required' });

    // check existing
    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ message: 'username taken' });

    if (email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) return res.status(409).json({ message: 'email already in use' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // auto-promote username 'admin' to admin role
    const role = username.trim().toLowerCase() === 'admin' ? 'admin' : 'user';

    const user = await User.create({ username, passwordHash: hash, avatar, email, role });
    res.status(201).json({ _id: user._id, username: user.username, avatar: user.avatar, role: user.role || 'user', email: user.email });
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

    res.json({ _id: user._id, username: user.username, avatar: user.avatar, role: user.role || 'user', email: user.email });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'login failed' });
  }
});

// POST /api/users/google-login
router.post('/google-login', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ message: 'Google credential required' });

    // Verify token with Google API
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (!response.ok) {
      return res.status(401).json({ message: 'Invalid Google token' });
    }
    const payload = await response.json();
    const { email, name, picture } = payload;

    if (!email) return res.status(400).json({ message: 'Email not provided by Google' });

    // Find user by email
    let user = await User.findOne({ email });
    let isNewUser = false;

    if (!user) {
      return res.status(404).json({ message: "No account found with this Google email. Please register first on the Sign Up page." });
    }

    res.json({
      _id: user._id,
      username: user.username,
      avatar: user.avatar,
      role: user.role || 'user',
      email: user.email,
      isNewUser
    });
  } catch (e) {
    console.error('Google login error', e);
    res.status(500).json({ message: 'Google login failed' });
  }
});

// POST /api/users/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });

    const user = await User.findOne({ email });
    if (!user) {
      // Don't leak exists/not info for security
      return res.json({ message: 'If the email exists, an OTP has been sent.' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.otp = { code: otpCode, expiresAt };
    await user.save();

    await sendOTPEmail(email, otpCode);

    res.json({ message: 'If the email exists, an OTP has been sent.' });
  } catch (e) {
    console.error('forgot-password error', e);
    res.status(500).json({ message: 'Failed to request password reset' });
  }
});

// POST /api/users/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otpCode, newPassword } = req.body;
    if (!email || !otpCode || !newPassword) {
      return res.status(400).json({ message: 'email, otpCode and newPassword required' });
    }

    const user = await User.findOne({ email });
    if (!user || !user.otp || user.otp.code !== otpCode) {
      return res.status(400).json({ message: 'Invalid OTP code' });
    }

    if (new Date() > user.otp.expiresAt) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);

    user.passwordHash = hash;
    user.otp = undefined; // clear OTP
    await user.save();

    res.json({ message: 'Password has been reset successfully.' });
  } catch (e) {
    console.error('reset-password error', e);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

// GET /api/users/profile (protected)
router.get('/profile', authCheck, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.user.username });
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      _id: user._id,
      username: user.username,
      avatar: user.avatar,
      role: user.role || 'user',
      email: user.email,
      bio: user.bio || ""
    });
  } catch (e) {
    console.error('GET /api/users/profile error', e);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// PUT /api/users/profile (protected)
router.put('/profile', authCheck, async (req, res) => {
  try {
    const { avatar, bio } = req.body;
    
    // Find and update
    const user = await User.findOneAndUpdate(
      { username: req.user.username },
      { 
        ...(avatar !== undefined && { avatar }),
        ...(bio !== undefined && { bio })
      },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      _id: user._id,
      username: user.username,
      avatar: user.avatar,
      role: user.role || 'user',
      email: user.email,
      bio: user.bio || ""
    });
  } catch (e) {
    console.error('PUT /api/users/profile error', e);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

module.exports = router;