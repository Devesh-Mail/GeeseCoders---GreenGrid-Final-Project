const jwt = require('jsonwebtoken');
const { Users } = require('../data/db');

function requireAuth(req, res, next) {
  const header = req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated. Log in first.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
    const user = Users.find(payload.sub);
    if (!user) return res.status(401).json({ error: 'Session user no longer exists.' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: `This endpoint requires the "${role}" role.` });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
