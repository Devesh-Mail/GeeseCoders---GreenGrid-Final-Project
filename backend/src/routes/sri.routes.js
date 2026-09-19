/**
 * SRI — the GreenGrid assistant
 * ===============================================================
 * Design stance, which is the whole point of this file:
 *
 * A chatbot bolted onto a dashboard is decoration. Sri is built the
 * other way round — it is a QUERY LAYER OVER REAL PLATFORM STATE.
 * Every factual answer it gives is read live from the database or
 * computed by the GreenScore engine. It never invents a number.
 *
 * The architecture mirrors the report classifier: facts stay
 * deterministic, language is optional.
 *
 *   1. Deterministic intent router matches the question to a handler.
 *   2. The handler gathers REAL data and builds the answer.
 *   3. If ANTHROPIC_API_KEY is set, Claude rephrases that answer more
 *      naturally — but it is given the facts and told not to add any.
 *      Without a key, the templated answer is returned as-is.
 *
 * So Sri cannot hallucinate a GreenScore, because it is never the
 * thing producing one. Answers carry a `sources` array naming exactly
 * which records were read, so any claim can be checked.
 */
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  Users, Events, Missions, Reports, Rewards, Pools, Goals,
  Campaigns, Actions, Certificates, Transactions, Guilds,
} = require('../data/db');
const { computeGreenScore, recommendations, ASSUMPTIONS, MODEL_VERSION } = require('../utils/greenscore');
const { run: runValidation } = require('../utils/greenscore.validate');

const router = express.Router();

/* ------------------------------------------------------------------ *
 * Intent routing — keyword scoring, deliberately transparent.
 * Each intent declares the words that select it; the highest scoring
 * intent wins. Simple, inspectable, and it never silently drifts.
 * ------------------------------------------------------------------ */
const INTENTS = [
  { id: 'my_impact',      words: ['my impact', 'my co2', 'how much have i', 'my stats', 'my progress', 'my level', 'my xp', 'my points', 'my streak'] },
  { id: 'improve_event',  words: ['improve', 'reduce', 'lower', 'better score', 'raise score', 'greener', 'recommend', 'suggestion', 'advice'] },
  { id: 'explain_score',  words: ['how is greenscore', 'how do you calculate', 'how does the score', 'what is greenscore', 'explain the score', 'where does the number', 'assumption', 'coefficient', 'model'] },
  { id: 'validate',       words: ['validate', 'validation', 'proof', 'prove', 'accurate', 'trust', 'verify the model', 'is it correct', 'test'] },
  { id: 'find_events',    words: ['event', 'what is happening', 'whats on', 'attend', 'register', 'greenest', 'upcoming'] },
  { id: 'ecopool',        words: ['ecopool', 'carpool', 'pool', 'ride', 'travel', 'commute', 'lift'] },
  { id: 'missions',       words: ['mission', 'quest', 'task', 'what should i do', 'earn xp', 'earn points'] },
  { id: 'rewards',        words: ['reward', 'redeem', 'spend', 'wallet', 'greenpoints balance', 'voucher'] },
  { id: 'certificate',    words: ['certificate', 'credential', 'resume', 'linkedin', 'proof of participation'] },
  { id: 'trust',          words: ['trust tier', 'cheat', 'fake', 'fak', 'lie', 'lying', 'verified', 'self-report', 'anti-cheat', 'stops people', 'game the system', 'abuse'] },
  { id: 'sponsor',        words: ['sponsor', 'campaign', 'roi', 'budget', 'green deposit', 'funding'] },
  { id: 'mentor',         words: ['mentor', 'mentorship', 'guidance', 'help me learn', 'coach', 'expert', 'session', 'book a call'] },
  { id: 'report_issue',   words: ['report', 'issue', 'problem', 'broken', 'garbage', 'leak', 'complaint'] },
  { id: 'about',          words: ['what is greengrid', 'what can you do', 'who are you', 'help', 'hello', 'hi ', 'hey'] },
];

function routeIntent(text) {
  const q = ' ' + String(text || '').toLowerCase().trim() + ' ';
  let best = { id: 'about', score: 0 };
  INTENTS.forEach(intent => {
    let score = 0;
    intent.words.forEach(w => { if (q.includes(w)) score += w.length; });
    if (score > best.score) best = { id: intent.id, score };
  });
  return best;
}

const fmt = n => Number(n || 0).toLocaleString('en-IN');

/* ------------------------------------------------------------------ *
 * Handlers — each returns { text, sources, actions? }
 * `sources` names the real records read, so nothing is unverifiable.
 * ------------------------------------------------------------------ */
const HANDLERS = {
  about() {
    return {
      text: `I'm Sri, the GreenGrid assistant. I read live platform data rather than guessing, so anything I tell you can be checked.\n\nI can help with: your impact so far, how to improve an event's GreenScore, how the score is actually calculated (and how it's validated), finding greener events, EcoPool rides, missions, rewards, certificates, and booking a sustainability mentor.`,
      sources: [],
      actions: [
        { label: 'How is GreenScore calculated?', send: 'How is GreenScore calculated?' },
        { label: 'How do I improve my event?', send: 'How do I improve my event score?' },
        { label: 'Find me a mentor', send: 'I want mentorship' },
      ],
    };
  },

  my_impact(ctx) {
    if (!ctx.user) return { text: 'Sign in and I can pull up your impact figures.', sources: [] };
    const u = Users.find(ctx.user.id);
    const acts = Actions.forUser(u.id);
    const verified = acts.filter(a => a.tier !== 'self_reported').length;
    const certs = Certificates.forUser(u.id).length;
    return {
      text: `You're level ${u.level} with ${fmt(u.xp)} XP and ${fmt(u.greenPoints)} GreenPoints.\n\nEstimated CO₂e avoided: ${u.co2SavedKg} kg, across ${acts.length} logged action(s) — ${verified} of them event-verified or better. Current streak: ${u.streakDays} day(s). Certificates earned: ${certs}.\n\nThat CO₂ figure is weighted by evidence: self-reported actions count at 40%, event-verified at 85%. So it's a conservative number, not a flattering one.`,
      sources: [`User:${u.id}`, `Actions(${acts.length})`, `Certificates(${certs})`],
    };
  },

  explain_score() {
    const a = ASSUMPTIONS;
    return {
      text: `GreenScore is computed by a deterministic engine (${MODEL_VERSION}) — no language model is involved in producing the number, because a score you can't reproduce isn't worth much.\n\nFive categories:\n• Transport — ${a.transportPerAttendeeKg.value} kg per physical attendee, one round trip. Does NOT scale with event length.\n• Energy — ${a.energyPerAttendeeHourKg.value} kg per attendee per hour (HVAC, lighting, AV).\n• Food — ${a.foodPerMealKg.value} kg per meal served, meals derived from duration.\n• Waste — ${a.wastePerAttendeeKg.value} kg per physical attendee.\n• Materials — ${a.materialsPerAttendeeKg.value} kg per attendee (badges, printed certs, signage).\n\nThe score is then the ratio of your footprint to your event's own duration-aware budget — so a 24-hour hackathon and a 2-hour seminar can both score 90 by each being well-run for what they are.\n\nBeing straight with you: these coefficients are planning estimates from public averages, not measurements from your campus. The honest claim is "estimated from a transparent, versioned model", never "we measured this".`,
      sources: [`GreenScore:${MODEL_VERSION}`, 'ASSUMPTIONS'],
      actions: [{ label: 'Is the model validated?', send: 'Is the GreenScore model validated?' }],
    };
  },

  validate() {
    const v = runValidation();
    return {
      text: `Yes — the model ships with a validation suite you can run yourself (\`node src/utils/greenscore.validate.js\`, or GET /api/events/model/validate).\n\nLatest run on ${v.modelVersion}:\n• ${v.summary.invariants} invariants passed, swept across ${fmt(v.summary.configurationsSwept)} event configurations\n• ${v.summary.regressionCases} hand-checked regression cases passed\n\nInvariants include things like "adding a green action can never lower the score" and "8× the duration must not produce 8× the footprint" — that second one exists because an earlier version of the model DID bill transport hourly, which made a 24-hour hackathon score 5/100. The check was written so that bug can't come back.\n\nImportant limit: this validates internal consistency, not real-world accuracy. Proving the coefficients match actual emissions needs a pilot with real attendance logs and utility meter readings. We haven't done that, and I'm not going to imply we have.`,
      sources: [`Validation:${v.modelVersion}`, `${v.summary.configurationsSwept} configs`],
    };
  },

  improve_event(ctx) {
    const ev = ctx.eventId ? Events.find(ctx.eventId)
      : Events.all().slice().sort((a, b) => a.greenScore - b.greenScore)[0];
    if (!ev) return { text: "I couldn't find an event to analyse.", sources: [] };
    const recs = recommendations(ev, ev.checklist).filter(r => r.co2SavedKg > 0);
    const model = computeGreenScore(ev);
    if (!recs.length) {
      return { text: `"${ev.title}" already has every available action applied — it's at ${ev.greenScore}/100.`, sources: [`Event:${ev.id}`] };
    }
    const lines = recs.slice(0, 4).map((r, i) => `${i + 1}. ${r.label} — saves ~${r.co2SavedKg} kg, +${r.scoreGain} points`).join('\n');
    return {
      text: `"${ev.title}" currently scores ${ev.greenScore}/100 at an estimated ${fmt(model.co2EstimateKg)} kg CO₂e (budget ${fmt(model.carbonBudgetKg)} kg — ${model.underBudget ? 'under' : fmt(model.overBudgetKg) + ' kg over'}).\n\nRanked by actual impact for this specific event:\n${lines}\n\nBiggest single lever is ${recs[0].label.toLowerCase()}. These are computed from the event's own numbers, not a generic tips list.`,
      sources: [`Event:${ev.id}`, `GreenScore:${model.modelVersion}`],
    };
  },

  find_events() {
    const evs = Events.all().slice().sort((a, b) => b.greenScore - a.greenScore).slice(0, 4);
    const lines = evs.map(e => `• ${e.title} — GreenScore ${e.greenScore}/100${e.certified ? ' ✓ certified' : ''}, ${new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${e.location}`).join('\n');
    return { text: `Upcoming events, greenest first:\n\n${lines}`, sources: [`Events(${evs.length})`] };
  },

  ecopool(ctx) {
    const ev = ctx.eventId ? Events.find(ctx.eventId) : Events.all()[0];
    const pools = ev ? Pools.forEvent(ev.id) : [];
    if (!pools.length) {
      return { text: `No EcoPool groups have formed yet${ev ? ` for "${ev.title}"` : ''}. You can start one from the event page — pick your corridor and others travelling the same way will join.`, sources: ev ? [`Event:${ev.id}`] : [] };
    }
    const lines = pools.map(p => `• ${p.corridor} — ${p.memberIds.length}/${p.capacity} riders, ~${p.co2SavedKg} kg saved${p.memberIds.length >= p.capacity ? ' (full)' : ''}`).join('\n');
    return {
      text: `EcoPool groups for "${ev.title}":\n\n${lines}\n\nMatching is on a broad corridor only — never your exact address. The system just needs to know two people head the same direction to the same event.`,
      sources: [`Event:${ev.id}`, `Pools(${pools.length})`],
    };
  },

  missions(ctx) {
    const ms = Missions.all().slice(0, 5);
    const lines = ms.map(m => `• ${m.title} — +${m.xp} XP, +${m.greenPoints} GP`).join('\n');
    return { text: `Active missions:\n\n${lines}\n\nEach one logs a real action, so completing it moves your actual impact number, not just a counter.`, sources: [`Missions(${ms.length})`] };
  },

  rewards(ctx) {
    const rs = Rewards.all();
    const bal = ctx.user ? Users.find(ctx.user.id).greenPoints : null;
    const lines = rs.map(r => `• ${r.title} — ${r.cost} GP (${r.sponsor})${bal !== null && bal >= r.cost ? ' — affordable now' : ''}`).join('\n');
    return {
      text: `${bal !== null ? `You have ${fmt(bal)} GreenPoints.\n\n` : ''}Rewards:\n\n${lines}\n\nAnything above 500 GP needs at least one event-verified action — self-reported claims still earn points, they just can't spend sponsor money.`,
      sources: [`Rewards(${rs.length})`],
    };
  },

  certificate(ctx) {
    const mine = ctx.user ? Certificates.forUser(ctx.user.id) : [];
    return {
      text: mine.length
        ? `You have ${mine.length} certificate(s):\n\n${mine.map(c => `• ${c.eventTitle} — code ${c.code}, ${c.co2Kg} kg CO₂e across ${c.actionsCompleted} action(s)`).join('\n')}\n\nEach code is publicly verifiable, so a recruiter can confirm it without a GreenGrid account.`
        : `You don't have a certificate yet. Complete at least one action at an event and you can claim one.\n\nThey carry a public verify code — a credential nobody outside the platform can check isn't really a credential.`,
      sources: [`Certificates(${mine.length})`],
    };
  },

  trust() {
    return {
      text: `Fair question, and the honest answer isn't "we ban liars".\n\nEvery action carries a trust tier that changes how much it COUNTS:\n• Self-reported — weight 0.4, can't draw sponsor funds\n• Event-verified — weight 0.85 (check-in or EcoPool membership is the evidence)\n• Sensor/API-verified — weight 1.0\n\nA self-reported action still earns XP and keeps your streak alive. It just carries less weight in campus totals and can't unlock high-value sponsor rewards. Nobody gets accused of anything — the number simply reflects how well it's evidenced.`,
      sources: ['TRUST_TIERS'],
    };
  },

  sponsor() {
    const cs = Campaigns.all();
    if (!cs.length) return { text: 'No sponsor campaigns are running yet.', sources: [] };
    const c = cs[0];
    const remaining = c.budgetInr + c.rolledOverInr - c.spentInr;
    return {
      text: `"${c.title}" by ${c.sponsorName}:\n• ₹${fmt(c.spentInr)} deployed of ₹${fmt(c.budgetInr)}\n• ${fmt(c.actionsFunded)} verified actions funded\n• ${fmt(Math.round(c.co2AttributedKg))} kg CO₂e attributed\n• ₹${fmt(remaining)} still available\n\nThe Green Deposit rule: unclaimed budget rolls forward to the next event rather than expiring. That removes the "what if turnout is bad" objection — the sponsor never loses money to a quiet week.`,
      sources: [`Campaign:${c.id}`],
    };
  },

  report_issue() {
    const open = Reports.all().filter(r => r.status !== 'resolved').length;
    return {
      text: `You can file a campus environmental issue from the Report page. It gets classified deterministically — category, urgency, responsible team, confidence — and clustered with related reports so twelve people reporting one overflowing bin becomes one incident, not twelve tickets.\n\nCurrently ${open} report(s) open.`,
      sources: [`Reports(open:${open})`],
    };
  },

  mentor() {
    return {
      text: `GreenGrid has a mentorship layer — real people, not me.\n\nMentors are matched on the specific thing you're stuck on (event carbon planning, waste systems, sponsorship, campus policy), and you book a slot from their real availability. Sessions run over a video link, and each one ends with written notes and action items attached to your profile.\n\nI'm useful for looking things up; a mentor is useful when you need judgement.`,
      sources: [],
      actions: [{ label: 'Show me available mentors', open: 'mentors.html' }],
    };
  },
};

/* Optional Claude rephrasing — facts in, phrasing out, nothing added. */
async function rephrase(answer, question) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: 'You rephrase an assistant answer to sound natural and concise. CRITICAL: you may not add, change, or invent any fact, number, name or claim. Use only what is given. If the draft admits a limitation, keep that admission. Keep it under 130 words. Return only the rephrased text.',
        messages: [{ role: 'user', content: `User asked: "${question}"\n\nDraft answer (facts are all correct, do not alter them):\n${answer}` }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.content || []).map(b => b.text || '').join('').trim();
    return text || null;
  } catch { return null; }
}

/* ------------------------------------------------------------------ *
 * POST /api/sri/ask
 * ------------------------------------------------------------------ */
router.post('/ask', async (req, res) => {
  const { message, eventId = null } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'message is required.' });
  }

  // Auth is optional: Sri answers general questions to anyone, and
  // personal ones only when it can identify you.
  let user = null;
  try {
    const hdr = req.header('authorization');
    if (hdr && hdr.startsWith('Bearer ')) {
      const jwt = require('jsonwebtoken');
      const payload = jwt.verify(hdr.slice(7), process.env.JWT_SECRET || 'dev-secret-change-me');
      user = Users.find(payload.sub) || null;
    }
  } catch { user = null; }

  const intent = routeIntent(message);
  const handler = HANDLERS[intent.id] || HANDLERS.about;
  const base = handler({ user, eventId });

  const phrased = await rephrase(base.text, message);

  res.json({
    reply: phrased || base.text,
    intent: intent.id,
    // Every claim traceable to the records that produced it.
    sources: base.sources || [],
    actions: base.actions || [],
    phrasedByLlm: !!phrased,
    engine: phrased ? 'deterministic-facts + llm-phrasing' : 'deterministic',
  });
});

/** What Sri can do — used to render suggestion chips in the UI. */
router.get('/capabilities', (req, res) => {
  res.json({
    name: 'Sri',
    grounding: 'Every factual answer is read from live platform records or computed by the GreenScore engine. Sri never generates a number itself.',
    intents: INTENTS.map(i => i.id),
    llmPhrasing: !!process.env.ANTHROPIC_API_KEY,
    starters: [
      'How is GreenScore calculated?',
      'Is the model validated?',
      'How do I improve my event score?',
      "What's my impact so far?",
      'Find me a mentor',
      'What stops people faking actions?',
    ],
  });
});

module.exports = router;
