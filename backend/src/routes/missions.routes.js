const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { Missions, Transactions, grant, Users } = require('../data/db');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const doneToday = new Set(
    Transactions.forUser(req.user.id)
      .filter(t => t.kind === 'mission' && new Date(t.createdAt).toDateString() === new Date().toDateString())
      .map(t => t.refId)
  );
  const missions = Missions.all().map(m => ({ ...m, completedToday: doneToday.has(m.id) }));
  res.json({ missions, streakDays: req.user.streakDays });
});

router.post('/:id/complete', requireAuth, (req, res) => {
  const m = Missions.find(req.params.id);
  if (!m) return res.status(404).json({ error: 'Mission not found.' });
  const already = Transactions.forUser(req.user.id).some(t =>
    t.kind === 'mission' && t.refId === m.id && new Date(t.createdAt).toDateString() === new Date().toDateString()
  );
  if (already) return res.status(409).json({ error: 'Already completed today. Missions reset daily.' });

  const tx = grant(req.user, { kind: 'mission', refId: m.id, xp: m.xp, greenPoints: m.greenPoints, co2Kg: m.co2Kg, note: `Completed mission: ${m.title}` });
  const fresh = Users.find(req.user.id);
  res.json({ transaction: tx, user: { xp: fresh.xp, level: fresh.level, greenPoints: fresh.greenPoints, co2SavedKg: fresh.co2SavedKg, streakDays: fresh.streakDays } });
});

module.exports = router;
