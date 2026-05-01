// uplift-backend/routes/supportRoutes.js
const express = require('express');
const router = express.Router();
const SupportSession = require('../models/SupportSession');
const authCheck = require('../middleware/authCheck');
const SupportMessage = require('../models/SupportMessage');



/*
  NOTE: server.js must call:
    app.set('io', io);
  so we can access the socket server here via req.app.get('io')
*/

// POST  /api/support/session
// create support session (protected)
router.post('/session', authCheck, async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user._id) return res.status(401).json({ message: 'unauthorized' });

    const doc = await SupportSession.create({
      userId: user._id,
      userName: user.username || 'anonymous',
      userAvatar: user.avatar || null,
      status: 'open',
      createdAt: new Date()
    });

    // emit to admins that a new support session was created
    const io = req.app.get('io');
    if (io) {
      // either broadcast to a dedicated admin room or global event
      // admins are expected to join the "admins" room on connection
      io.to('admins').emit('support:newSession', {
        sessionId: doc._id,
        userId: doc.userId,
        userName: doc.userName,
        userAvatar: doc.userAvatar,
        createdAt: doc.createdAt
      });
    }

    return res.status(201).json(doc);
  } catch (e) {
    console.error('POST /support/session error', e);
    return res.status(500).json({ message: 'failed to create support session' });
  }
});

// GET /api/support/session/:id/messages
// Returns messages for a support session (protected)
router.get('/session/:id/messages', authCheck, async (req, res) => {
  try {
    const sessionId = req.params.id;
    const msgs = await SupportMessage.find({ sessionId }).sort({ createdAt: 1 }).limit(1000).lean();
    return res.json(msgs);
  } catch (e) {
    console.error('GET /support/session/:id/messages error', e);
    return res.status(500).json({ message: 'failed to fetch messages' });
  }
});


// POST /api/support/session/:id/call-request
// user requests a call from admin/team
router.post('/session/:id/call-request', authCheck, async (req, res) => {
  try {
    const { phone, preferredAt } = req.body;
    if (!phone) return res.status(400).json({ message: 'phone required' });

    const s = await SupportSession.findById(req.params.id);
    if (!s) return res.status(404).json({ message: 'session not found' });

    s.requestedCall = {
      phone,
      preferredAt: preferredAt || null,
      status: 'requested',
      requestedAt: new Date()
    };
    await s.save();

    // Notify admins via socket (best-effort)
    const io = req.app.get('io');
    if (io) {
      io.to('admins').emit('support:callRequested', {
        sessionId: s._id,
        userId: s.userId,
        userName: s.userName,
        phone,
        preferredAt: s.requestedCall.preferredAt,
        requestedAt: s.requestedCall.requestedAt
      });
    }

    return res.json({ ok: true, session: s });
  } catch (e) {
    console.error('POST /support/session/:id/call-request error', e);
    return res.status(500).json({ message: 'failed to request call' });
  }
});

// POST /api/support/session/:id/book
// book a psychiatrist session (protected)
router.post('/session/:id/book', authCheck, async (req, res) => {
  try {
    const { psychiatristId, slotStart, slotEnd } = req.body;
    if (!psychiatristId || !slotStart || !slotEnd) {
      return res.status(400).json({ message: 'psychiatristId, slotStart and slotEnd required' });
    }

    const s = await SupportSession.findById(req.params.id);
    if (!s) return res.status(404).json({ message: 'session not found' });

    s.bookings = s.bookings || [];
    const booking = {
      psychiatristId,
      slotStart: new Date(slotStart),
      slotEnd: new Date(slotEnd),
      status: 'booked',
      bookedAt: new Date()
    };
    s.bookings.push(booking);
    await s.save();

    // notify admins / scheduling service via socket
    const io = req.app.get('io');
    if (io) {
      io.to('admins').emit('support:bookingCreated', {
        sessionId: s._id,
        userId: s.userId,
        userName: s.userName,
        booking
      });
    }

    return res.json({ ok: true, session: s });
  } catch (e) {
    console.error('POST /support/session/:id/book error', e);
    return res.status(500).json({ message: 'failed to create booking' });
  }
});

module.exports = router;
