const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { Events } = require('../data/db');
const { newEvent } = require('../entities/Event');
const { computeGreenScore, simulate, recommendations, ASSUMPTIONS } = require('../utils/greenscore');

const router = express.Router();

router.get('/', (req, res) => {
  const { category } = req.query;
  let events = Events.all();
  if (category && category !== 'All events') events = events.filter(e => e.category === category);
  res.json({ events: events.sort((a, b) => new Date(a.date) - new Date(b.date)) });
});

router.get('/:id', (req, res) => {
  const ev = Events.find(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found.' });
  res.json({ event: ev });
});

router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  const { title, category, date, location, attendeeCount, durationHrs, mode, venueType, checklist } = req.body;
  if (!title || !category || !date) return res.status(400).json({ error: 'title, category and date are required.' });
  const ev = newEvent({ title, category, date, location, organizerId: req.user.id, attendeeCount, durationHrs, mode, venueType, checklist });
  const gs = computeGreenScore(ev);
  Object.assign(ev, { greenScore: gs.greenScore, co2EstimateKg: gs.co2EstimateKg, carbonBudgetKg: gs.carbonBudgetKg, certified: gs.greenScore >= 75 });
  Events.create(ev);
  res.status(201).json({ event: ev, model: gs });
});

/**
 * "What-if" simulator — pure calculation, no persistence, drives the
 * live UI toggles. Returns the ranked recommendations alongside the
 * score so the organiser sees what to do next, not just where they are.
 * This is the ONLY scoring endpoint the frontend may call: the browser
 * must never hold a second copy of the model, or the two will drift and
 * show different numbers for the same event.
 */
router.post('/simulate', (req, res) => {
  const { attendeeCount = 300, durationHrs = 24, mode = 'offline', venueType = 'auditorium', checklist = {}, month = null } = req.body;
  const cfg = { attendeeCount, durationHrs, mode, venueType, month };
  const result = simulate(cfg, checklist);
  res.json({ result, recommendations: recommendations(cfg, checklist) });
});

/** The model's own assumptions, so any number can be traced to its basis. */
router.get('/model/assumptions', (req, res) => {
  res.json({ modelVersion: require('../utils/greenscore').MODEL_VERSION, assumptions: ASSUMPTIONS });
});

/** Runs the validation suite live — proof, not assertion. */
router.get('/model/validate', (req, res) => {
  res.json(require('../utils/greenscore.validate').run());
});

/** Full Impact Receipt for one event: score, split, counterfactual, provenance. */
router.get('/:id/receipt', (req, res) => {
  const ev = Events.find(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found.' });
  const model = computeGreenScore(ev);
  res.json({
    event: { id: ev.id, title: ev.title, date: ev.date, location: ev.location, attendeeCount: ev.attendeeCount, durationHrs: ev.durationHrs, mode: ev.mode, venueType: ev.venueType, checklist: ev.checklist, certified: ev.certified },
    model,
    issuedAt: new Date().toISOString(),
  });
});

/** Ranked, event-specific improvement advice. */
router.get('/:id/recommendations', (req, res) => {
  const ev = Events.find(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found.' });
  res.json({ recommendations: recommendations(ev, ev.checklist) });
});

/** Apply a set of checklist actions and re-score the event. */
router.patch('/:id/checklist', requireAuth, requireRole('admin'), (req, res) => {
  const ev = Events.find(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found.' });
  ev.checklist = Object.assign({}, ev.checklist, req.body.checklist || {});
  if (req.body.mode) ev.mode = req.body.mode;
  const gs = computeGreenScore(ev);
  Object.assign(ev, { greenScore: gs.greenScore, co2EstimateKg: gs.co2EstimateKg, carbonBudgetKg: gs.carbonBudgetKg });
  Events.save();
  res.json({ event: ev, model: gs });
});

router.post('/:id/certify', requireAuth, requireRole('admin'), (req, res) => {
  const ev = Events.find(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found.' });
  if (ev.greenScore < 60) return res.status(400).json({ error: 'GreenScore must be at least 60 to certify. Improve the checklist first.' });
  ev.certified = true;
  Events.save();
  res.json({ event: ev });
});

module.exports = router;
