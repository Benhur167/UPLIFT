// uplift-backend/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const authCheck = require('../middleware/authCheck');

// Helper to send email (supports Resend API, Brevo API, SMTP, with console fallback)
async function sendOTPEmail(email, otpCode) {
  console.log(`[OTP Code Generated] Email: ${email} | Code: ${otpCode}`);

  const subject = "Uplift Password Reset OTP Code";
  const htmlContent = `<p>Your OTP code for password reset is: <b>${otpCode}</b></p><p>It will expire in 10 minutes.</p>`;
  const textContent = `Your OTP code for password reset is: ${otpCode}. It expires in 10 minutes.`;

  // 1. Try Resend API if API Key is present (HTTP based, works on Render free tier)
  if (process.env.RESEND_API_KEY) {
    try {
      console.log('Attempting to send OTP email via Resend API...');
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: 'Uplift <onboarding@resend.dev>',
          to: [email],
          subject: subject,
          html: htmlContent
        })
      });
      const data = await response.json();
      if (response.ok) {
        console.log('OTP Email sent successfully via Resend API:', data);
        return;
      } else {
        console.error('[Resend API Error]', data);
      }
    } catch (err) {
      console.error('[Resend Connection Error]', err.message);
    }
  }

  // 2. Try Brevo API if API Key is present (HTTP based, works on Render free tier)
  if (process.env.BREVO_API_KEY) {
    try {
      console.log('Attempting to send OTP email via Brevo API...');
      const senderEmail = process.env.SMTP_USER || 'no-reply@uplift-emotional-support.org';
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': process.env.BREVO_API_KEY,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'Uplift Support', email: senderEmail },
          to: [{ email: email, name: 'Uplift User' }],
          subject: subject,
          htmlContent: htmlContent
        })
      });
      const data = await response.json();
      if (response.ok) {
        console.log('OTP Email sent successfully via Brevo API:', data);
        return;
      } else {
        console.error('[Brevo API Error]', data);
      }
    } catch (err) {
      console.error('[Brevo Connection Error]', err.message);
    }
  }

  // 3. Fallback to standard SMTP if credentials are present
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      console.log('Attempting to send OTP email via Gmail SMTP...');
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      await transporter.sendMail({
        from: `"Uplift Support" <${process.env.SMTP_USER}>`,
        to: email,
        subject: subject,
        text: textContent,
        html: htmlContent
      });
      console.log('OTP Email sent successfully via SMTP');
      return;
    } catch (err) {
      console.error('[OTP ERROR] Failed to send email via SMTP:', err.message);
    }
  }

  console.warn('[OTP WARNING] All email services failed or were not configured. OTP code logged to console.');
  console.log(`[OTP FALLBACK] You can retrieve the OTP from server logs: ${otpCode}`);
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

    // Send email asynchronously in the background so SMTP timeouts don't block the HTTP response
    sendOTPEmail(email, otpCode).catch(err => {
      console.error('[Background OTP Send Error]', err.message);
    });

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