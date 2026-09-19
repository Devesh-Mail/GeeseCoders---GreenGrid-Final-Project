/**
 * VIRTUAL MENTORSHIP
 * ===============================================================
 * How this is handled, precisely:
 *
 *  1. MATCHING is explainable. A student states what they're stuck on;
 *     mentors are scored on overlapping expertise, then on language and
 *     availability. The API returns the REASON for every match, so a
 *     student sees "matched on event carbon planning + waste systems",
 *     not an opaque ranking. Same inputs always give the same order.
 *
 *  2. BOOKING is against real declared slots. A mentor publishes
 *     availability; booking one removes it atomically so two students
 *     cannot take the same slot. No "we'll get back to you" limbo.
 *
 *  3. CONNECTING IS ONLINE by default. Every confirmed booking carries
 *     a joinUrl. In this prototype that's a deterministic Jitsi Meet
 *     room derived from the session id — Jitsi needs no account, no API
 *     key and no server of ours, so the link genuinely works right now
 *     rather than being a placeholder. Swapping in Google Meet or Zoom
 *     later means changing one function, because every consumer reads
 *     `session.joinUrl` and nothing else.
 *
 *  4. SESSIONS CLOSE THE LOOP. A finished session records written notes
 *     and action items against the student's profile, so mentorship
 *     produces a durable artifact instead of a conversation that
 *     evaporates. Unattended sessions are marked, not silently dropped.
 */
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { Users, Mentors, Sessions, grant } = require('../data/db');
const { newSession } = require('../entities/Mentor');

const router = express.Router();

/** Jitsi rooms need no credentials, so this link is real, not a stub. */
function joinUrlFor(sessionId) {
  return `https://meet.jit.si/greengrid-${sessionId}`;
}

/* ------------------------------------------------------------------ *
 * GET /api/mentors — browse, or match against a stated need
 * ------------------------------------------------------------------ */
router.get('/', (req, res) => {
  const { need = '', topic = '' } = req.query;
  const query = `${need} ${topic}`.toLowerCase().trim();

  const scored = Mentors.all().map(m => {
    const openSlots = m.slots.filter(s => !s.bookedBy);
    let score = 0;
    const matchedOn = [];

    if (query) {
      m.expertise.forEach(e => {
        // Match on the whole phrase, or on any meaningful word in it.
        const words = e.toLowerCase().split(/[\s/]+/).filter(w => w.length > 3);
        if (query.includes(e.toLowerCase())) { score += 10; matchedOn.push(e); }
        else if (words.some(w => query.includes(w))) { score += 5; matchedOn.push(e); }
      });
    }
    // Availability is a tiebreak, never the main signal — a perfectly
    // matched mentor with one slot should still beat a poor match with ten.
    score += Math.min(3, openSlots.length);
    if (m.rating >= 4.5) score += 1;

    return {
      ...m,
      openSlots: openSlots.length,
      nextSlot: openSlots[0] || null,
      matchScore: score,
      matchedOn: [...new Set(matchedOn)],
      // Stated plainly so the ranking is never mysterious.
      matchReason: matchedOn.length
        ? `Matched on ${[...new Set(matchedOn)].join(', ')}`
        : query ? 'No direct expertise overlap — listed by availability'
                : 'Listed by availability',
    };
  }).sort((a, b) => b.matchScore - a.matchScore);

  res.json({
    mentors: scored,
    matchingExplained: 'Mentors are ranked by expertise overlap with your stated need (exact phrase 10 points, related term 5), then availability (up to 3) and rating (1). Deterministic — the same request always returns the same order.',
  });
});

router.get('/:id', (req, res) => {
  const m = Mentors.find(req.params.id);
  if (!m) return res.status(404).json({ error: 'Mentor not found.' });
  res.json({ mentor: { ...m, openSlots: m.slots.filter(s => !s.bookedBy) } });
});

/* ------------------------------------------------------------------ *
 * POST /api/mentors/:id/book
 * ------------------------------------------------------------------ */
router.post('/:id/book', requireAuth, (req, res) => {
  const { slotId, topic = '', question = '' } = req.body || {};
  const mentor = Mentors.find(req.params.id);
  if (!mentor) return res.status(404).json({ error: 'Mentor not found.' });

  const slot = mentor.slots.find(s => s.id === slotId);
  if (!slot) return res.status(404).json({ error: 'That slot does not exist.' });
  // Claim the slot before creating the session, so a race can't
  // double-book: the second caller finds bookedBy already set.
  if (slot.bookedBy) return res.status(409).json({ error: 'That slot was just taken. Please pick another.' });

  const already = Sessions.forUser(req.user.id).find(s => s.mentorId === mentor.id && s.status === 'confirmed');
  if (already) return res.status(409).json({ error: 'You already have an upcoming session with this mentor.' });

  slot.bookedBy = req.user.id;

  const session = newSession({
    mentorId: mentor.id, mentorName: mentor.name,
    studentId: req.user.id, studentName: req.user.name,
    startsAt: slot.startsAt, durationMins: slot.durationMins,
    topic, question,
  });
  session.joinUrl = joinUrlFor(session.id);
  Sessions.create(session);
  Mentors.save();

  res.status(201).json({
    session,
    joinUrl: session.joinUrl,
    message: 'Booked. The video link works immediately — no account or install needed on either side.',
  });
});

/* ------------------------------------------------------------------ *
 * Sessions
 * ------------------------------------------------------------------ */
router.get('/sessions/mine', requireAuth, (req, res) => {
  const mine = Sessions.forUser(req.user.id)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  res.json({ sessions: mine });
});

/** Cancel — frees the slot again rather than leaving it stranded. */
router.post('/sessions/:id/cancel', requireAuth, (req, res) => {
  const s = Sessions.find(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found.' });
  if (s.studentId !== req.user.id) return res.status(403).json({ error: 'That is not your session.' });
  if (s.status !== 'confirmed') return res.status(409).json({ error: `Session is already ${s.status}.` });

  s.status = 'cancelled';
  const mentor = Mentors.find(s.mentorId);
  if (mentor) {
    const slot = mentor.slots.find(x => x.startsAt === s.startsAt && x.bookedBy === req.user.id);
    if (slot) slot.bookedBy = null;
    Mentors.save();
  }
  Sessions.save();
  res.json({ session: s, message: 'Cancelled, and the slot is open for someone else again.' });
});

/**
 * Complete a session with notes — this is what makes mentorship produce
 * something durable instead of evaporating when the call ends.
 */
router.post('/sessions/:id/complete', requireAuth, (req, res) => {
  const { notes = '', actionItems = [], rating = null } = req.body || {};
  const s = Sessions.find(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found.' });
  if (s.studentId !== req.user.id && s.mentorId !== req.user.id) {
    return res.status(403).json({ error: 'Only the participants can close this session.' });
  }
  if (!notes.trim()) return res.status(400).json({ error: 'Notes are required — a session with no record is not much use later.' });

  s.status = 'completed';
  s.completedAt = new Date().toISOString();
  s.notes = notes;
  s.actionItems = Array.isArray(actionItems) ? actionItems.map(t => ({ text: t, done: false })) : [];
  if (rating) {
    const m = Mentors.find(s.mentorId);
    if (m) {
      m.ratingCount = (m.ratingCount || 0) + 1;
      m.rating = +(((m.rating * (m.ratingCount - 1)) + Number(rating)) / m.ratingCount).toFixed(2);
      Mentors.save();
    }
  }
  Sessions.save();

  const user = Users.find(s.studentId);
  let tx = null;
  if (user) {
    tx = grant(user, {
      kind: 'mission', refId: s.id, xp: 80, greenPoints: 40, co2Kg: 0,
      note: `Completed mentorship session: ${s.topic || s.mentorName}`,
    });
  }
  res.json({ session: s, transaction: tx });
});

/** Tick off an action item from a past session. */
router.post('/sessions/:id/actions/:idx/toggle', requireAuth, (req, res) => {
  const s = Sessions.find(req.params.id);
  if (!s) return res.status(404).json({ error: 'Session not found.' });
  if (s.studentId !== req.user.id) return res.status(403).json({ error: 'That is not your session.' });
  const item = (s.actionItems || [])[Number(req.params.idx)];
  if (!item) return res.status(404).json({ error: 'Action item not found.' });
  item.done = !item.done;
  Sessions.save();
  res.json({ actionItems: s.actionItems });
});

module.exports = router;
