// uplift-backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// standard middleware
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// DB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ProjectUplift';
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Mongo connected'))
  .catch(e => console.error('Mongo connect error', e));

// models (ensure these files exist)
const Message = require('./models/Message');     // { roomId, sender, avatar, text, createdAt }
const Community = require('./models/Community');
const SupportSession = require('./models/SupportSession'); // should include messages[] if you want history
const User = require('./models/User'); // used by authCheck and other routes

// ROUTES: require route modules
const storyRoutes = require('./routes/storyRoutes');
const communityRoutes = require('./routes/communityRoutes');
const supportRoutes = require('./routes/supportRoutes');
const userRoutes = require('./routes/userRoutes');

// mount API routes
app.use('/api/stories', storyRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/users', userRoutes);

// socket.io init
const io = new Server(server, {
  cors: { origin: "http://localhost:3000", methods: ["GET","POST"], credentials: true },
  transports: ["websocket", "polling"],
  pingInterval: 25000,
  pingTimeout: 60000,
  allowEIO3: true
});
app.set("io", io);

// helper to normalize support room name
const supportRoom = (sessionId) => `support_${sessionId}`;

// ----------------- SOCKET HANDLERS -----------------
io.on('connection', (socket) => {
  console.log('⚡ socket connected', socket.id);

  // Admins join a global admins room to receive new-session notifications
  socket.on('joinAdminRoom', () => {
    socket.join('admins');
    console.log(`socket ${socket.id} joined admins room`);
  });

  // Generic join (community or legacy)
  socket.on('joinRoom', async (payload) => {
    try {
      if (!payload) return;
      const { roomId, username, avatar } = payload;
      if (!roomId || !username) return;

      socket.join(roomId);
      console.log(`socket ${socket.id} joined ${roomId} as ${username}`);

      // Update Community.members in DB (idempotent)
      try {
        const comm = await Community.findById(roomId);
        if (comm) {
          comm.members = comm.members || [];
          if (!comm.members.includes(username)) {
            comm.members.push(username);
            await comm.save();
          }
          // emit updated members to room so clients update
          io.to(roomId).emit('communityUpdated', { roomId, members: comm.members, membersCount: comm.members.length });
        } else {
          io.to(roomId).emit('communityUpdated', { roomId, members: [], membersCount: 0 });
        }
      } catch (e) {
        console.warn('community join DB update failed', e);
      }
    } catch (e) {
      console.error('joinRoom error', e);
    }
  });

  // Community chat message (existing)
  socket.on('chatMessage', async (payload) => {
    try {
      if (!payload || !payload.roomId || !payload.text) {
        console.warn('chatMessage missing required fields', payload);
        return;
      }

      const msgDoc = await Message.create({
        roomId: payload.roomId,
        sender: payload.sender || 'anonymous',
        avatar: payload.avatar || null,
        text: payload.text
      });

      const out = msgDoc.toObject ? msgDoc.toObject() : msgDoc;
      if (payload.clientId) out.clientId = payload.clientId;

      // broadcast saved message to room (server-saved message)
      io.to(payload.roomId).emit('chatMessage', out);
    } catch (e) {
      console.error('failed to handle chatMessage', e);
    }
  });

  // typing indicator — broadcast to room
  socket.on('typing', (payload) => {
    try {
      if (!payload) return;
      const { roomId, user, typing } = payload;
      if (!roomId) return;
      io.to(roomId).emit('typing', { roomId, user, typing });
    } catch (e) {
      console.error('typing event error', e);
    }
  });

  // ----------------- SUPPORT / ADMIN specific -----------------

  // user/admin joins a support session
  // payload: { sessionId, username, avatar, role }
  socket.on('support:join', async (payload) => {
    try {
      if (!payload || !payload.sessionId) return;
      const { sessionId, username, avatar, role } = payload;
      const room = supportRoom(sessionId);
      socket.join(room);
      socket.supportSessionId = sessionId;
      socket.role = role || 'user';
      socket.username = username || `user_${socket.id}`;

      console.log(`socket ${socket.id} (${socket.username}) joined ${room} as ${socket.role}`);

      // notify room members of presence
      if (socket.role === 'admin') {
        io.to(room).emit('admin_joined', { sessionId, admin: socket.username });
      } else {
        io.to(room).emit('user_joined', { sessionId, user: socket.username });
      }
    } catch (e) {
      console.error('support:join error', e);
    }
  });

  // legacy join used in your client code
  socket.on('join_support_session', ({ sessionId, userId } = {}) => {
    try {
      if (!sessionId) return;
      const room = supportRoom(sessionId);
      socket.join(room);
      socket.supportSessionId = sessionId;
      socket.role = 'user';
      socket.userId = userId;
      console.log(`socket ${socket.id} joined ${room} (legacy join_support_session)`);
      io.to(room).emit('user_joined', { sessionId, userId });
    } catch (e) {
      console.error('join_support_session error', e);
    }
  });

  // user/admin sends a support message
  // payload: { sessionId, text|message, clientId?, senderId, senderName, senderType }
  socket.on('support:message', async (payload) => {
    try {
      if (!payload || !payload.sessionId) {
        console.warn('support:message missing sessionId', payload);
        return;
      }

      // accept payload.text or payload.message (clients may send either)
      const text = payload.text ?? payload.message ?? null;
      if (!text) {
        console.warn('support:message missing text/message', payload);
        return;
      }

      const sessionId = String(payload.sessionId);
      const room = supportRoom(sessionId);

      // canonical message object
      const message = {
        _id: payload._id || `msg_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
        sessionId,
        text,
        clientId: payload.clientId || null, // preserve clientId if client provided it
        senderId: payload.senderId || socket.userId || null,
        senderName: payload.senderName || payload.sender || socket.username || null,
        senderType: payload.senderType || socket.role || 'user',
        createdAt: new Date().toISOString(),
      };

      // Persist into SupportSession.messages if model supports it
      try {
        const sess = await SupportSession.findById(sessionId);
        if (sess) {
          sess.messages = sess.messages || [];
          sess.messages.push({
            _id: message._id,
            sender: message.senderId || message.senderName,
            senderName: message.senderName,
            text: message.text,
            senderType: message.senderType,
            clientId: message.clientId,
            createdAt: message.createdAt
          });
          await sess.save();
        }
      } catch (e) {
        console.warn('failed to persist support message to SupportSession', e);
      }

      // Emit once (single canonical event). Include clientId so the client can match/replace optimistic stub.
      io.to(room).emit('support:message', message);
    } catch (e) {
      console.error('support:message handler error', e);
    }
  });

  // typing indicators from admin or user
  // payload: { sessionId, userName, typing }
  socket.on('support:typing', (payload) => {
    try {
      if (!payload || !payload.sessionId) return;
      const room = supportRoom(payload.sessionId);
      const eventForRoom = (socket.role === 'admin') ? 'admin_typing' : 'support:typing';
      io.to(room).emit(eventForRoom, {
        sessionId: payload.sessionId,
        userName: payload.userName || socket.username,
        typing: payload.typing ?? true
      });
    } catch (e) {
      console.error('support:typing error', e);
    }
  });

  // legacy user_typing events from client
  socket.on('user_typing', (payload) => {
    try {
      if (!payload || !payload.sessionId) return;
      const room = supportRoom(payload.sessionId);
      io.to(room).emit('support:typing', { sessionId: payload.sessionId, userName: payload.userId || payload.user || socket.username, typing: payload.typing ?? true });
    } catch (e) {
      console.error('user_typing error', e);
    }
  });

  // call requested from client (we forward to room + admins)
  socket.on('support:callRequested', (payload) => {
    try {
      if (!payload || !payload.sessionId) return;
      const room = supportRoom(payload.sessionId);
      const out = { sessionId: payload.sessionId, phone: payload.phone || null, createdAt: new Date().toISOString(), by: socket.username || payload.by };
      io.to(room).emit('support:callRequested', out);
      io.to('admins').emit('support:callRequested', out); // notify admins
    } catch (e) {
      console.error('support:callRequested error', e);
    }
  });

  // booking created event (forward)
  socket.on('support:bookingCreated', (payload) => {
    try {
      if (!payload || !payload.sessionId) return;
      const room = supportRoom(payload.sessionId);
      const out = { sessionId: payload.sessionId, slot: payload.slot || null, createdAt: new Date().toISOString(), by: socket.username || payload.by };
      io.to(room).emit('support:bookingCreated', out);
      io.to('admins').emit('support:bookingCreated', out);
    } catch (e) {
      console.error('support:bookingCreated error', e);
    }
  });

  // handle disconnect
  socket.on('disconnect', (reason) => {
    try {
      if (socket.supportSessionId && socket.role === 'admin') {
        const room = supportRoom(socket.supportSessionId);
        io.to(room).emit('admin_left', { sessionId: socket.supportSessionId, admin: socket.username });
      }
    } catch (e) {
      console.error('disconnect handling error', e);
    }
    console.log('🔌 socket disconnected', socket.id, 'reason=', reason);
  });

  socket.on('connect_error', (err) => {
    console.log('socket connect_error', socket.id, err && err.message);
  });
});
// ----------------- END SOCKET HANDLERS -----------------

// --- REST endpoints related to messages ---
// Community room history (existing)
app.get('/api/messages/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const list = await Message.find({ roomId }).sort({ createdAt: 1 }).limit(500).lean();
    res.json(list);
  } catch (e) {
    console.error('GET /api/messages/:roomId error', e);
    res.status(500).json({ message: 'failed to fetch messages' });
  }
});

// REST fallback to save a community message if socket couldn't be used
app.post('/api/messages/save-fallback', async (req, res) => {
  try {
    const { roomId, sender = 'anonymous', avatar = null, text, clientId } = req.body;
    if (!roomId || !text) return res.status(400).json({ message: 'roomId and text required' });

    const msgDoc = await Message.create({ roomId, sender, avatar, text });
    const out = msgDoc.toObject ? msgDoc.toObject() : msgDoc;
    if (clientId) out.clientId = clientId;

    // broadcast to socket room (best-effort)
    try { io.to(roomId).emit('chatMessage', out); } catch (e) { console.warn('broadcast after fallback save failed', e); }

    res.status(201).json(out);
  } catch (e) {
    console.error('POST /api/messages/save-fallback error', e);
    res.status(500).json({ message: 'failed to save message' });
  }
});

// --- Support session message history & fallback routes ---
// Fetch messages stored on SupportSession.messages
app.get('/api/support/session/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const sess = await SupportSession.findById(id).lean();
    if (!sess) return res.status(404).json({ message: 'Session not found' });
    const msgs = Array.isArray(sess.messages) ? sess.messages : [];
    // normalize to { _id, sender, text, createdAt, senderType, clientId }
    const out = msgs.map((m, idx) => ({
      _id: m._id || `msg_${idx}`,
      sender: m.sender || m.senderName || 'unknown',
      text: m.text,
      createdAt: m.createdAt || m.created_at,
      senderType: m.senderType || m.type || 'user',
      clientId: m.clientId || null
    }));
    return res.json({ messages: out });
  } catch (e) {
    console.error('GET /api/support/session/:id/messages error', e);
    return res.status(500).json({ message: 'failed to fetch session messages' });
  }
});

// Save one message to a support session (REST fallback if socket unavailable)
app.post('/api/support/session/:id/message', async (req, res) => {
  try {
    const { id } = req.params;
    const { text, senderId, senderName, senderType, clientId } = req.body;
    if (!text) return res.status(400).json({ message: 'text required' });

    // push to SupportSession.messages if session exists
    const sess = await SupportSession.findById(id);
    if (!sess) return res.status(404).json({ message: 'Session not found' });

    sess.messages = sess.messages || [];
    const msg = {
      _id: `msg_${Date.now()}`,
      sender: senderId || senderName || 'fallback',
      senderName: senderName || senderId,
      text,
      senderType: senderType || 'user',
      clientId: clientId || null,
      createdAt: new Date()
    };
    sess.messages.push(msg);
    await sess.save();

    // emit to room
    try {
      io.to(supportRoom(id)).emit('support:message', {
        _id: msg._id,
        sessionId: id,
        text: msg.text,
        senderId: msg.sender,
        senderName: msg.senderName,
        senderType: msg.senderType,
        clientId: msg.clientId,
        createdAt: msg.createdAt
      });
    } catch (e) {
      console.warn('emit after saving fallback message failed', e);
    }

    return res.status(201).json({ ok: true, message: msg });
  } catch (e) {
    console.error('POST /api/support/session/:id/message error', e);
    return res.status(500).json({ message: 'failed to save message' });
  }
});

// Optional helper endpoint to notify admins of a new session
// You can call this from inside your supportRoutes POST /session after creating the session.
// Example usage inside your route: await fetch('http://localhost:5000/api/support/notify-new-session', { method: 'POST', headers: {...}, body: JSON.stringify({ sessionId, userId, userName }) })
app.post('/api/support/notify-new-session', async (req, res) => {
  try {
    const { sessionId, userId, userName } = req.body;
    if (!sessionId) return res.status(400).json({ message: 'sessionId required' });
    // emit to admins room
    io.to('admins').emit('support:newSession', { sessionId, userId, userName, createdAt: new Date().toISOString() });
    return res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/support/notify-new-session error', e);
    return res.status(500).json({ message: 'failed to notify admins' });
  }
});
// server.js OR routes/supportRoutes.js (wherever /api/support routes are implemented)
// POST /api/support/session/:id/call-request
app.post('/api/support/session/:id/call-request', async (req, res) => {
  try {
    const { id } = req.params;
    const { phone, preferredAt } = req.body;
    const username = req.headers['x-username'] || (req.user && req.user.username) || 'anonymous';

    if (!phone) return res.status(400).json({ message: 'phone required' });

    const sess = await SupportSession.findById(id);
    if (!sess) return res.status(404).json({ message: 'session not found' });

    const requestedCall = {
      phone,
      preferredAt: preferredAt ? new Date(preferredAt) : null,
      status: 'requested',
      createdAt: new Date(),
      by: username,
    };

    sess.requestedCall = requestedCall;
    await sess.save();

    // emit to session room (so the user sees status) and notify admins
    const io = req.app.get('io');
    const out = { sessionId: id, requestedCall, userId: sess.userId || sess.user || null, userName: sess.userName || sess.user || username };
    try {
      io.to(`support_${id}`).emit('support:callRequested', out);
      io.to('admins').emit('support:callRequested', out);
    } catch (e) {
      console.warn('emit support:callRequested failed', e);
    }

    return res.json({ ok: true, session: sess, requestedCall });
  } catch (e) {
    console.error('POST call-request error', e);
    return res.status(500).json({ message: 'failed to request call' });
  }
});
// POST /api/support/session/:id/call-action
// payload: { action: 'assign'|'schedule'|'complete'|'cancel', scheduledAt?, notes? }
app.post('/api/support/session/:id/call-action', /* authCheck, adminCheck, */ async (req, res) => {
  try {
    const { id } = req.params;
    const { action, scheduledAt, notes } = req.body;
    // if you use auth middleware, req.user will be present:
    const adminUser = req.headers['x-username'] || (req.user && req.user.username) || 'admin';

    const sess = await SupportSession.findById(id);
    if (!sess) return res.status(404).json({ message: 'session not found' });

    sess.requestedCall = sess.requestedCall || {};
    const rc = sess.requestedCall;

    if (action === 'assign') {
      rc.status = 'assigned';
      rc.adminAssigned = adminUser;
      rc.adminNotes = notes || rc.adminNotes;
    } else if (action === 'schedule') {
      rc.status = 'scheduled';
      rc.scheduledAt = scheduledAt ? new Date(scheduledAt) : rc.scheduledAt;
      rc.adminAssigned = adminUser;
      rc.adminNotes = notes || rc.adminNotes;
    } else if (action === 'complete') {
      rc.status = 'completed';
      rc.completedAt = new Date();
      rc.adminAssigned = adminUser;
      rc.adminNotes = notes || rc.adminNotes;
    } else if (action === 'cancel') {
      rc.status = 'cancelled';
      rc.adminNotes = notes || rc.adminNotes;
    } else {
      return res.status(400).json({ message: 'unknown action' });
    }

    // Save
    sess.requestedCall = rc;
    await sess.save();

    // Emit update to session room and admins
    const io = req.app.get('io');
    const out = { sessionId: id, requestedCall: rc, admin: adminUser };
    try {
      io.to(`support_${id}`).emit('support:callUpdated', out);
      io.to('admins').emit('support:callUpdated', out);
    } catch (e) {
      console.warn('emit support:callUpdated failed', e);
    }

    return res.json({ ok: true, requestedCall: rc });
  } catch (e) {
    console.error('POST call-action error', e);
    return res.status(500).json({ message: 'failed to update call' });
  }
});

// --- Add these routes near your other REST endpoints in server.js ---

// List open/active support sessions (basic)
app.get('/api/support/sessions', async (req, res) => {
  try {
    // return latest 200 sessions sorted newest first
    const list = await SupportSession.find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    // normalize shape expected by AdminDashboard
    const sessions = (list || []).map(s => ({
      _id: s._id,
      sessionId: s._id,
      userId: s.userId || s.user || null,
      userName: s.userName || s.user || (s.createdByName || null),
      createdAt: s.createdAt || s.created_at || new Date().toISOString(),
      status: s.status || 'open',
      requestedCall: s.requestedCall || null,
      bookings: s.bookings || []
    }));
    return res.json({ sessions });
  } catch (e) {
    console.error('GET /api/support/sessions error', e);
    return res.status(500).json({ message: 'failed to fetch sessions' });
  }
});

// Get single support session details
app.get('/api/support/session/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sess = await SupportSession.findById(id).lean();
    if (!sess) return res.status(404).json({ message: 'session not found' });

    return res.json(sess);
  } catch (e) {
    console.error('GET /api/support/session/:id error', e);
    return res.status(500).json({ message: 'failed to fetch session' });
  }
});

// (You already have a messages endpoint — replace/ensure it is like this:)
app.get('/api/support/session/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const sess = await SupportSession.findById(id).lean();
    if (!sess) return res.status(404).json({ message: 'Session not found' });

    const msgs = Array.isArray(sess.messages) ? sess.messages : [];
    // safe normalization: ensure each message has createdAt and text
    const out = msgs.map((m, idx) => ({
      _id: m._id || m.id || `msg_${idx}_${Date.now()}`,
      sender: m.sender || m.senderName || m.user || 'unknown',
      senderId: m.senderId || m.sender || null,
      text: m.text || m.message || '',
      createdAt: m.createdAt || m.created_at || m.timestamp || new Date().toISOString(),
      senderType: m.senderType || m.type || 'user',
      clientId: m.clientId || null
    }));
    return res.json({ messages: out });
  } catch (e) {
    console.error('GET /api/support/session/:id/messages error', e);
    return res.status(500).json({ message: 'failed to fetch session messages' });
  }
});



// start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running http://localhost:${PORT}`));
