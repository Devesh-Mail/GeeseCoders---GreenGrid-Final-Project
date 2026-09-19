const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { Events, Reports, Users, grant, Guilds } = require('../data/db');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/overview', (req, res) => {
  const events = Events.all();
  const avgScore = events.length ? Math.round(events.reduce((s, e) => s + e.greenScore, 0) / events.length) : 0;
  res.json({
    myEvents: events.filter(e => e.organizerId === req.user.id || true), // demo: admin sees all events
    stats: {
      totalEvents: events.length,
      certified: events.filter(e => e.certified).length,
      avgGreenScore: avgScore,
      openReports: Reports.all().filter(r => r.status !== 'resolved').length,
      totalStudents: Users.all().filter(u => u.role === 'student').length,
    },
    guilds: Guilds.all(),
  });
});

router.get('/reports', (req, res) => {
  res.json({ reports: Reports.all().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

router.post('/reports/:id/resolve', (req, res) => {
  const r = Reports.find(req.params.id);
  if (!r) return res.status(404).json({ error: 'Report not found.' });
  r.status = 'resolved';
  r.resolvedAt = new Date().toISOString();
  Reports.save();

  const reporter = Users.find(r.reporterId);
  let tx = null;
  if (reporter) {
    tx = grant(reporter, { kind: 'report_resolved', refId: r.id, xp: 100, greenPoints: 50, co2Kg: 0, note: `Campus resolved your report: ${r.title}` });
  }
  res.json({ report: r, transaction: tx });
});

module.exports = router;
