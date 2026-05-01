// middleware/authCheck.js
const User = require('../models/User');

module.exports = async function authCheck(req, res, next) {
  try {
    // Accept username from body or headers
    const username =
      (req.body && req.body.username) ||
      req.headers['x-username'] ||
      req.headers['x-user'] ||
      null;

    // Debug: show exactly what arrived (useful for UI/client issues)
    console.log('authCheck incoming:', {
      method: req.method,
      path: req.path,
      usernameFromBody: req.body && req.body.username,
      xUsername: req.headers['x-username'],
      xUser: req.headers['x-user']
    });

    if (!username) {
      console.warn('authCheck: no username provided');
      return res.status(401).json({ message: 'no username provided' });
    }

    // Look up user
    let user = await User.findOne({ username }).lean();

    // DEV convenience: auto-create the user if not found (only in non-production)
    if (!user && process.env.NODE_ENV !== 'production') {
      console.log('authCheck dev: creating user', username);
      const created = await User.create({
        username,
        name: username,
        email: `${username}@example.com`
      });
      // created might be a mongoose doc; convert to plain object
      user = created.toObject ? created.toObject() : created;
    }

    if (!user) {
      console.warn('authCheck: user not found', username);
      return res.status(401).json({ message: 'invalid user' });
    }

    // Attach minimal user info to the request for downstream handlers
    req.user = {
      _id: user._id,
      username: user.username,
      avatar: user.avatar || user.avatarUrl || null
    };

    return next();
  } catch (e) {
    console.error('authCheck error', e && e.stack ? e.stack : e);
    return res.status(500).json({ message: 'auth error' });
  }
};
