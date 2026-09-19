// Auto-heal the #1 "backend isn't working" cause: a missing .env file.
// If backend/.env doesn't exist yet, copy it from .env.example before
// dotenv loads, so a fresh `npm install && npm start` just works.
const fs = require('fs');
const path = require('path');
(function ensureEnvFile() {
  const envPath = path.join(__dirname, '.env');
  const examplePath = path.join(__dirname, '.env.example');
  if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log('🛠  backend/.env was missing — created it from .env.example automatically.');
  }
})();

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const apiKey = require('./src/middleware/apiKey');
const db = require('./src/data/db');

const authRoutes = require('./src/routes/auth.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const eventsRoutes = require('./src/routes/events.routes');
const missionsRoutes = require('./src/routes/missions.routes');
const leaderboardRoutes = require('./src/routes/leaderboard.routes');
const reportsRoutes = require('./src/routes/reports.routes');
const opendataRoutes = require('./src/routes/opendata.routes');
const adminRoutes = require('./src/routes/admin.routes');
const rewardsRoutes = require('./src/routes/rewards.routes');
const impactRoutes = require('./src/routes/impact.routes');
const embedRoutes = require('./src/routes/embed.routes');
const sriRoutes = require('./src/routes/sri.routes');
const mentorRoutes = require('./src/routes/mentors.routes');

const app = express();
// Restrict CORS to the origin in ALLOWED_ORIGIN (set this in .env for
// production). Falls back to '*' only when explicitly requested or when
// the var is not set, preserving the original open-dev behaviour.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({
  origin: ALLOWED_ORIGIN === '*' ? '*' : ALLOWED_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));
app.use(express.json());

// Health check is deliberately exempt from the API key so uptime
// monitors / a quick curl can confirm the server is alive.
app.get('/health', (req, res) => res.json({ ok: true, service: 'greengrid-backend', time: new Date().toISOString() }));

// Embed routes are public by design: a badge rendered on someone else's
// site cannot carry a secret key, since anyone could read it from the
// page source. They are strictly read-only.
app.use('/api/embed', embedRoutes);

app.use('/api', apiKey);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/missions', missionsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/opendata', opendataRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rewards', rewardsRoutes);
app.use('/api/impact', impactRoutes);
app.use('/api/sri', sriRoutes);
app.use('/api/mentors', mentorRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

db.init();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🌱 GreenGrid backend running on http://localhost:${PORT}`);
  console.log(`   Demo student login: rohan@campus.edu / student123`);
  console.log(`   Demo admin login:   organizer@campus.edu / admin123`);
});
