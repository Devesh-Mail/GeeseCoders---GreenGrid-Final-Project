const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  Events, Users, Pools, Actions, Certificates, Goals, Campaigns,
  grant, fundAction, rolloverCampaign, TRUST_TIERS,
} = require('../data/db');
const { newPoolGroup, newVerifiedAction, newCertificate, newCampaign } = require('../entities/Impact');

const router = express.Router();

/* ================================================================
 * ECOPOOL — turn attendees into transport infrastructure
 * ================================================================
 * Matching is on a coarse corridor string, never a precise address.
 * Two people only need to be going the same general direction to the
 * same event at the same time for a pool to make sense, and that is
 * all the data the system ever holds.
 */

/** Pools forming for an event, plus how many seats are left. */
router.get('/ecopool/:eventId', requireAuth, (req, res) => {
  const pools = Pools.forEvent(req.params.eventId).map(p => ({
    ...p,
    seatsLeft: Math.max(0, p.capacity - p.memberIds.length),
    joined: p.memberIds.includes(req.user.id),
  }));
  res.json({ pools, corridorsAvailable: [...new Set(pools.map(p => p.corridor))] });
});

/**
 * Join (or auto-create) a pool for a corridor. If an existing group on
 * that corridor has room, the student joins it — otherwise a new group
 * forms. This is the whole matching algorithm, and it is deliberately
 * simple and deterministic rather than an opaque "AI matcher".
 */
router.post('/ecopool/:eventId/join', requireAuth, (req, res) => {
  const { corridor } = req.body;
  if (!corridor) return res.status(400).json({ error: 'corridor is required (e.g. "OMR — Sholinganallur").' });
  const ev = Events.find(req.params.eventId);
  if (!ev) return res.status(404).json({ error: 'Event not found.' });

  const existing = Pools.forEvent(ev.id).filter(p => p.corridor === corridor);
  if (existing.some(p => p.memberIds.includes(req.user.id))) {
    return res.status(409).json({ error: 'You are already in a pool for this event.' });
  }

  let pool = existing.find(p => p.memberIds.length < p.capacity);
  let created = false;
  if (!pool) { pool = newPoolGroup({ eventId: ev.id, corridor }); Pools.create(pool); created = true; }

  pool.memberIds.push(req.user.id);
  // Each additional rider beyond the first is one car trip avoided.
  const savedForThisRider = pool.memberIds.length > 1 ? 1.8 : 0;
  pool.co2SavedKg = +(pool.co2SavedKg + savedForThisRider).toFixed(1);
  pool.status = pool.memberIds.length >= pool.capacity ? 'full' : 'forming';
  Pools.save();

  // An EcoPool join is event-verified: the group itself is the evidence.
  const action = newVerifiedAction({
    userId: req.user.id, eventId: ev.id, kind: 'ecopool',
    tier: savedForThisRider > 0 ? 'event_verified' : 'self_reported',
    rawCo2Kg: savedForThisRider, note: `EcoPool · ${corridor}`,
  });
  Actions.create(action);

  const tx = grant(req.user, {
    kind: 'mission', refId: pool.id, xp: 60, greenPoints: 30,
    co2Kg: action.weightedCo2Kg, note: `Joined EcoPool on ${corridor}`,
  });

  const funded = fundAction({ kind: 'ecopool', co2Kg: action.weightedCo2Kg, userId: req.user.id });
  contributeToGoal(ev.id, req.user.id, action.weightedCo2Kg);

  res.json({ pool, created, action, transaction: tx, sponsorFunding: funded });
});

/* ================================================================
 * VERIFIED ACTIONS — trust tiers, not binary anti-cheat
 * ================================================================ */

router.get('/trust-tiers', (req, res) => res.json({ tiers: TRUST_TIERS }));

/**
 * Log an action. The tier decides how much the claim counts, never
 * whether the student is believed: a self-reported action still earns
 * XP and keeps a streak alive, it simply carries less weight in campus
 * totals and cannot draw down sponsor money.
 */
router.post('/actions', requireAuth, (req, res) => {
  const { kind, eventId = null, tier = 'self_reported', rawCo2Kg = 0, note = '' } = req.body;
  if (!kind) return res.status(400).json({ error: 'kind is required.' });
  if (!TRUST_TIERS[tier]) return res.status(400).json({ error: 'Unknown trust tier.' });

  const action = newVerifiedAction({ userId: req.user.id, eventId, kind, tier, rawCo2Kg, note });
  Actions.create(action);

  const tx = grant(req.user, {
    kind: 'mission', refId: action.id, xp: 35, greenPoints: 18,
    co2Kg: action.weightedCo2Kg, note: note || `Logged action: ${kind}`,
  });

  // Only sufficiently-evidenced actions can draw sponsor funds.
  const funded = TRUST_TIERS[tier].canFundReward
    ? fundAction({ kind, co2Kg: action.weightedCo2Kg, userId: req.user.id })
    : null;
  if (eventId) contributeToGoal(eventId, req.user.id, action.weightedCo2Kg);

  res.status(201).json({
    action, transaction: tx, sponsorFunding: funded,
    explanation: `Claimed ${action.rawCo2Kg} kg, counted ${action.weightedCo2Kg} kg at ${TRUST_TIERS[tier].label} (weight ${TRUST_TIERS[tier].weight}).`,
  });
});

/* ================================================================
 * COLLECTIVE EVENT GOAL
 * ================================================================ */

function contributeToGoal(eventId, userId, co2Kg) {
  const goal = Goals.forEvent(eventId);
  if (!goal || goal.achieved) return null;
  goal.currentCo2Kg = +(goal.currentCo2Kg + co2Kg).toFixed(1);
  if (!goal.contributorIds.includes(userId)) goal.contributorIds.push(userId);
  if (goal.currentCo2Kg >= goal.targetCo2Kg) {
    goal.achieved = true;
    goal.achievedAt = new Date().toISOString();
  }
  Goals.save();
  return goal;
}

router.get('/goal/:eventId', (req, res) => {
  const goal = Goals.forEvent(req.params.eventId);
  if (!goal) return res.json({ goal: null });
  res.json({
    goal: {
      ...goal,
      progressPct: Math.min(100, Math.round((goal.currentCo2Kg / goal.targetCo2Kg) * 100)),
      contributors: goal.contributorIds.length,
    },
  });
});

/* ================================================================
 * CERTIFICATES — portable, independently verifiable proof
 * ================================================================ */

router.get('/certificates', requireAuth, (req, res) => {
  res.json({ certificates: Certificates.forUser(req.user.id) });
});

router.post('/certificates/issue', requireAuth, (req, res) => {
  const { eventId } = req.body;
  const ev = Events.find(eventId);
  if (!ev) return res.status(404).json({ error: 'Event not found.' });

  const mine = Actions.forUser(req.user.id).filter(a => a.eventId === eventId);
  if (mine.length === 0) return res.status(400).json({ error: 'Complete at least one action at this event before claiming a certificate.' });

  const co2 = mine.reduce((s, a) => s + a.weightedCo2Kg, 0);
  const cert = newCertificate({
    userId: req.user.id, userName: req.user.name,
    eventId: ev.id, eventTitle: ev.title,
    actionsCompleted: mine.length, co2Kg: co2, greenScore: ev.greenScore,
  });
  Certificates.create(cert);
  res.status(201).json({ certificate: cert, verifyUrl: `/api/embed/verify/${cert.code}` });
});

/**
 * Public verification — deliberately NOT behind requireAuth, because a
 * credential nobody outside the platform can check is not a credential.
 * Returns only what a verifier needs, never the holder's account data.
 */
router.get('/certificates/verify/:code', (req, res) => {
  const cert = Certificates.byCode(req.params.code);
  if (!cert) return res.status(404).json({ valid: false, error: 'No certificate with that code.' });
  res.json({
    valid: true,
    certificate: {
      code: cert.code, holder: cert.userName, event: cert.eventTitle,
      actionsCompleted: cert.actionsCompleted, co2Kg: cert.co2Kg,
      eventGreenScore: cert.greenScore, issuedAt: cert.issuedAt,
    },
  });
});

/* ================================================================
 * SPONSOR CAMPAIGNS — the Green Deposit
 * ================================================================ */

router.get('/campaigns', (req, res) => {
  const campaigns = Campaigns.all().map(c => {
    const remaining = c.budgetInr + c.rolledOverInr - c.spentInr;
    return {
      ...c,
      remainingInr: remaining,
      costPerActionInr: c.actionsFunded ? +(c.spentInr / c.actionsFunded).toFixed(2) : 0,
      costPerKgCo2Inr: c.co2AttributedKg ? +(c.spentInr / c.co2AttributedKg).toFixed(2) : 0,
      utilisationPct: Math.round((c.spentInr / (c.budgetInr + c.rolledOverInr)) * 100),
    };
  });
  res.json({ campaigns });
});

router.post('/campaigns', requireAuth, requireRole('admin'), (req, res) => {
  const { sponsorName, title, budgetInr, perActionInr, actionKinds, eventIds } = req.body;
  if (!sponsorName || !title || !budgetInr) return res.status(400).json({ error: 'sponsorName, title and budgetInr are required.' });
  const c = newCampaign({ sponsorName, title, budgetInr, perActionInr, actionKinds, eventIds });
  Campaigns.create(c);
  res.status(201).json({ campaign: c });
});

/** Close an event's funding window and roll unspent budget forward. */
router.post('/campaigns/:id/rollover', requireAuth, requireRole('admin'), (req, res) => {
  const result = rolloverCampaign(req.params.id, req.body.note);
  if (!result) return res.status(404).json({ error: 'Campaign not found.' });
  res.json({
    ...result,
    message: 'Unspent budget stays with the sponsor and carries to the next event rather than expiring.',
  });
});

module.exports = router;
