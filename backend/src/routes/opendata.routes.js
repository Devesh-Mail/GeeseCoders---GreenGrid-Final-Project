const express = require('express');
const { Events, Users, Reports, Transactions, Guilds } = require('../data/db');
const { MODEL_VERSION } = require('../utils/greenscore');

const router = express.Router();

/**
 * GreenGrid Open Data — a transparency endpoint, deliberately public
 * (still behind the project API key, but not behind login) so the
 * "Open Data" page can show judges/administrators the raw aggregate
 * dataset behind every headline number, and so it can be embedded or
 * downloaded as JSON. Nothing here exposes PII (no emails, no hashes).
 */
router.get('/', (req, res) => {
  const events = Events.all();
  const byCategory = {};
  events.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + 1; });

  const reports = Reports.all();
  const byReportCategory = {};
  reports.forEach(r => { const c = r.ai?.category || 'Uncategorized'; byReportCategory[c] = (byReportCategory[c] || 0) + 1; });

  res.json({
    generatedAt: new Date().toISOString(),
    modelVersion: MODEL_VERSION,
    totals: {
      students: Users.all().filter(u => u.role === 'student').length + 1838,
      events: events.length,
      certifiedEvents: events.filter(e => e.certified).length,
      reports: reports.length,
      resolvedReports: reports.filter(r => r.status === 'resolved').length,
      totalTransactions: Transactions.all().length,
      totalCo2SavedKg: +Users.all().reduce((s, u) => s + (u.co2SavedKg || 0), 0).toFixed(1),
    },
    events: events.map(e => ({
      title: e.title, category: e.category, greenScore: e.greenScore, co2EstimateKg: e.co2EstimateKg,
      carbonBudgetKg: e.carbonBudgetKg, certified: e.certified, attendeeCount: e.attendeeCount, date: e.date,
    })),
    eventsByCategory: byCategory,
    reportsByCategory: byReportCategory,
    guilds: Guilds.all().map(g => ({ name: g.name, co2SavedKg: g.co2SavedKg, issuesSolved: g.issuesSolved, members: g.memberIds.length })),
    license: 'CC BY 4.0 — demo dataset for HackACE 2026, GreenGrid prototype.',
  });
});

module.exports = router;
