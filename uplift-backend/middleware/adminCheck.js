// uplift-backend/middleware/adminCheck.js
module.exports = function adminCheck(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admins only" });
    }
    next();
  } catch (err) {
    console.error("adminCheck error:", err);
    res.status(500).json({ message: "Server error in adminCheck" });
  }
};
