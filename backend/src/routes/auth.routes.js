const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Users } = require('../data/db');
const { newUser } = require('../entities/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function sign(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET || 'dev-secret-change-me', { expiresIn: '7d' });
}

function publicUser(u) {
  const { passwordHash, ...safe } = u;
  return safe;
}

router.post('/register', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required.' });
  if (Users.findByEmail(email)) return res.status(409).json({ error: 'An account with that email already exists.' });
  const passwordHash = bcrypt.hashSync(password, 8);
  const user = newUser({ name, email, passwordHash, role: role === 'admin' ? 'admin' : 'student' });
  Users.create(user);
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password, role } = req.body;
  const user = Users.findByEmail(email || '');
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  if (role && user.role !== role) {
    return res.status(403).json({ error: `That account is registered as "${user.role}", not "${role}".` });
  }
  res.json({ token: sign(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
