const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { Reports, grant, Users, Missions } = require('../data/db');
const { newReport } = require('../entities/Report');
const { classify } = require('../utils/ai-router');
const { narrateReport, ENABLED: AI_INSIGHT_ENABLED } = require('../utils/ai-insight');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const mine = Reports.all().filter(r => r.reporterId === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ reports: mine });
});

router.post('/', requireAuth, async (req, res) => {
  const { title, category, location, description } = req.body;
  if (!title || !location || !description) {
    return res.status(400).json({ error: 'title, location and description are required.' });
  }
  const report = newReport({ title, category, location, description, reporterId: req.user.id });
  report.ai = classify(report, Reports.all());
  // Optional LLM narrative layer — never blocks or changes the deterministic
  // classification above; only adds a friendlier sentence when a key is present.
  report.ai.narrative = AI_INSIGHT_ENABLED ? await narrateReport(report) : null;
  report.status = report.ai.clusterId ? 'assigned' : 'analyzed';
  Reports.create(report);

  req.user.reportsFiled = (req.user.reportsFiled || 0) + 1;
  const reportMission = Missions.all().find(m => /report/i.test(m.title));
  const tx = grant(req.user, {
    kind: 'report_resolved', refId: report.id,
    xp: reportMission?.xp || 45, greenPoints: reportMission?.greenPoints || 22, co2Kg: 0,
    note: `Filed civic report: ${title}`,
  });

  res.status(201).json({ report, transaction: tx });
});

module.exports = router;
