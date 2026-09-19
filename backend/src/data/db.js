/**
 * db.js — the entire "database" for this hackathon prototype.
 * ---------------------------------------------------------------
 * In-memory objects, mirrored to db.json on every write so data
 * survives a server restart. This is intentionally simple: every
 * route only ever calls the functions exported here, so replacing
 * this file with a real MongoDB/Postgres/Prisma layer later never
 * touches route code — that's the whole point of the entities/
 * folder (each shape below matches an entity module exactly).
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const { newUser } = require('../entities/User');
const { newEvent } = require('../entities/Event');
const { newMission } = require('../entities/Mission');
const { newReport } = require('../entities/Report');
const { newGuild } = require('../entities/Guild');
const { newTransaction } = require('../entities/Transaction');
const { newReward } = require('../entities/Reward');
const { newMentor, newSlot, newSession } = require('../entities/Mentor');
const { newCampaign, newPoolGroup, newVerifiedAction, newCertificate, newEventGoal, TRUST_TIERS } = require('../entities/Impact');
const { computeGreenScore, levelFromXp } = require('../utils/greenscore');

const FILE = path.join(__dirname, 'db.json');

let db = {
  users: [],
  events: [],
  missions: [],
  reports: [],
  guilds: [],
  transactions: [],
  rewards: [],
  campaigns: [],
  pools: [],
  actions: [],
  certificates: [],
  goals: [],
  mentors: [],
  sessions: [],
};

function persist() {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

function load() {
  if (fs.existsSync(FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      // Older db.json files predate the impact-layer collections; backfill
      // them so an existing demo database keeps working after an upgrade.
      ['campaigns', 'pools', 'actions', 'certificates', 'goals', 'mentors', 'sessions'].forEach(k => { if (!db[k]) db[k] = []; });
      return true;
    } catch (e) { /* fall through to reseed */ }
  }
  return false;
}

function seed() {
  const guildA = newGuild({ name: 'Greenlight' });
  const guildB = newGuild({ name: 'CarbonZero Collective' });
  db.guilds.push(guildA, guildB);

  const demoStudentPw = bcrypt.hashSync('student123', 8);
  const demoAdminPw = bcrypt.hashSync('admin123', 8);

  const rohan = newUser({ name: 'Rohan Verma', email: 'rohan@campus.edu', passwordHash: demoStudentPw, role: 'student' });
  Object.assign(rohan, { xp: 2450, greenPoints: 840, co2SavedKg: 12.4, streakDays: 7, guildId: guildA.id, reportsFiled: 2, badges: ['eco_starter', 'carpool_captain'] });
  const admin = newUser({ name: 'Tech Club Organizer', email: 'organizer@campus.edu', passwordHash: demoAdminPw, role: 'admin' });
  db.users.push(rohan, admin);
  guildA.memberIds.push(rohan.id);
  guildA.co2SavedKg = 182; guildA.issuesSolved = 27; guildA.missionsRun = 341;
  guildB.co2SavedKg = 96; guildB.issuesSolved = 11; guildB.missionsRun = 158;

  const events = [
    { title: 'AI & ML Workshop', category: 'Workshops', date: daysFromNow(3), location: 'Innovation Lab', attendeeCount: 180, durationHrs: 4, mode: 'hybrid', venueType: 'hybrid-lab', checklist: { hybrid: true, digitalCerts: true } },
    { title: 'Cyber Security Summit', category: 'Workshops', date: daysFromNow(4), location: 'Main Auditorium', attendeeCount: 220, durationHrs: 6, mode: 'offline', venueType: 'auditorium', checklist: { wasteSeg: true } },
    { title: 'Startup Pitch Battle', category: 'Community', date: daysFromNow(5), location: 'Startup Hub', attendeeCount: 140, durationHrs: 3, mode: 'offline', venueType: 'classroom' },
    { title: 'Culture Fest — Kaleidoscope', category: 'Culture', date: daysFromNow(9), location: 'Open Grounds', attendeeCount: 900, durationHrs: 8, mode: 'offline', venueType: 'outdoor', checklist: { reusable: true, wasteSeg: true } },
    { title: 'AI Hackathon — HackACE', category: 'Tech', date: daysFromNow(12), location: 'College Auditorium', attendeeCount: 300, durationHrs: 24, mode: 'offline', venueType: 'auditorium' },
  ];
  events.forEach(e => {
    const ev = newEvent({ ...e, organizerId: admin.id });
    const gs = computeGreenScore(ev);
    Object.assign(ev, { greenScore: gs.greenScore, co2EstimateKg: gs.co2EstimateKg, carbonBudgetKg: gs.carbonBudgetKg, certified: gs.greenScore >= 75 });
    db.events.push(ev);
  });

  const missions = [
    { title: 'Carpool to an event', type: 'daily', xp: 50, greenPoints: 25, co2Kg: 1.8 },
    { title: 'Bring a reusable bottle', type: 'daily', xp: 30, greenPoints: 15, co2Kg: 0.6 },
    { title: 'Avoid a disposable cup', type: 'daily', xp: 25, greenPoints: 12, co2Kg: 0.4 },
    { title: 'Attend an event hybrid/remote', type: 'daily', xp: 40, greenPoints: 20, co2Kg: 2.1 },
    { title: 'Report a campus environmental issue', type: 'daily', xp: 45, greenPoints: 22, co2Kg: 0 },
  ];
  missions.forEach(m => db.missions.push(newMission(m)));

  const rewards = [
    { title: 'Free Campus Coffee', cost: 300, sponsor: 'Campus Café' },
    { title: 'Event Fast-Pass', cost: 500, sponsor: 'AllCollegeEvent' },
    { title: 'Cafeteria Coupon', cost: 700, sponsor: 'Campus Fund' },
    { title: 'GreenGrid Eco Merch', cost: 1000, sponsor: 'EcoRide' },
  ];
  rewards.forEach(r => db.rewards.push(newReward(r)));

  const reports = [
    { title: 'Overflowing garbage near auditorium', category: 'Waste', location: 'Block A', description: 'Bins overflowing after the last event, plastic waste scattered nearby.', reporterId: rohan.id },
    { title: 'Water leaking near cafeteria tap', category: 'Water', location: 'Cafeteria', description: 'Tap has been leaking since morning, small puddle forming.', reporterId: rohan.id },
  ];
  const { classify } = require('../utils/ai-router');
  reports.forEach(r => {
    const rep = newReport(r);
    rep.ai = classify(rep, db.reports);
    rep.status = 'analyzed';
    db.reports.push(rep);
  });

  /* ---- Impact layer seed: sponsor campaign, EcoPool, collective goal ---- */
  const hackathon = db.events.find(e => e.title.includes('Hackathon')) || db.events[0];
  const fest = db.events.find(e => e.title.includes('Culture')) || db.events[1];

  const campaign = newCampaign({
    sponsorName: 'EcoRide',
    title: '500 Green Rides Challenge',
    budgetInr: 50000,
    perActionInr: 12,
    actionKinds: ['ecopool', 'public_transport'],
    eventIds: [hackathon.id, fest.id],
  });
  Object.assign(campaign, {
    spentInr: 17640, actionsFunded: 1470, co2AttributedKg: 1842.5, studentsReached: 4820,
    ledger: [
      { at: daysFromNow(-6), kind: 'debit', amountInr: 9120, actions: 760, note: 'Culture Fest — EcoPool rides' },
      { at: daysFromNow(-2), kind: 'debit', amountInr: 8520, actions: 710, note: 'Workshop week — public transport claims' },
    ],
  });
  db.campaigns.push(campaign);

  const corridors = [
    { corridor: 'OMR — Sholinganallur', n: 4 },
    { corridor: 'Tambaram', n: 3 },
    { corridor: 'Velachery', n: 2 },
  ];
  corridors.forEach(c => {
    const pool = newPoolGroup({ eventId: hackathon.id, corridor: c.corridor });
    pool.memberIds = Array.from({ length: c.n }, (_, i) => 'seed_rider_' + i);
    pool.co2SavedKg = +(c.n * 1.8).toFixed(1);
    pool.status = pool.memberIds.length >= pool.capacity ? 'full' : 'forming';
    db.pools.push(pool);
  });

  const goal = newEventGoal({ eventId: hackathon.id, targetCo2Kg: 500, rewardLabel: 'EcoRide unlocks 200 GreenPoints for every participant' });
  goal.currentCo2Kg = 412;
  db.goals.push(goal);

  // A few verified actions across trust tiers so the trust model is
  // visible in the demo rather than only described.
  [
    { kind: 'ecopool', tier: 'event_verified', rawCo2Kg: 1.8 },
    { kind: 'reusable', tier: 'self_reported', rawCo2Kg: 0.6 },
    { kind: 'public_transport', tier: 'event_verified', rawCo2Kg: 2.1 },
  ].forEach(a => db.actions.push(newVerifiedAction({ userId: rohan.id, eventId: hackathon.id, ...a })));


  /* ---- Mentorship seed ---- */
  function slotsFrom(dayOffsets, hour) {
    return dayOffsets.map(d => {
      const dt = new Date(); dt.setDate(dt.getDate() + d); dt.setHours(hour, 0, 0, 0);
      return newSlot({ startsAt: dt.toISOString(), durationMins: 30 });
    });
  }
  [
    { name: 'Dr. Anitha Raghavan', title: 'Sustainability Lead', org: 'Chennai Climate Collective', avatar: '🌏',
      expertise: ['Event carbon planning', 'Carbon accounting', 'Campus policy'], rating: 4.9, ratingCount: 34,
      languages: ['English', 'Tamil'],
      bio: 'Fifteen years measuring and reducing emissions for public events. Helps organisers find the few changes that actually move the number.',
      slots: slotsFrom([1, 2, 4], 16) },
    { name: 'Karthik Subramanian', title: 'Waste Systems Engineer', org: 'Namma Waste', avatar: '♻️',
      expertise: ['Waste systems', 'Composting', 'Vendor management'], rating: 4.7, ratingCount: 21,
      languages: ['English', 'Tamil'],
      bio: 'Designs segregation systems for campuses and festivals. Very practical about what survives contact with a real crowd.',
      slots: slotsFrom([1, 3, 5], 11) },
    { name: 'Priya Menon', title: 'CSR & Partnerships', org: 'GreenBridge Advisory', avatar: '🤝',
      expertise: ['Sponsorship', 'CSR funding', 'Impact reporting'], rating: 4.8, ratingCount: 29,
      languages: ['English', 'Malayalam'],
      bio: 'Sits on the sponsor side of the table. Blunt about what makes a student proposal fundable and what gets ignored.',
      slots: slotsFrom([2, 3, 6], 18) },
    { name: 'Arjun Nair', title: 'Mobility Researcher', org: 'IIT Madras', avatar: '🚲',
      expertise: ['Transport emissions', 'Commute modelling', 'EcoPool design'], rating: 4.6, ratingCount: 17,
      languages: ['English', 'Hindi'],
      bio: 'Studies campus commuting patterns. Good on why transport dominates most event footprints and what shifts it.',
      slots: slotsFrom([2, 4, 7], 15) },
  ].forEach(m => db.mentors.push(newMentor(m)));

  persist();
}

function daysFromNow(n) {
  const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString();
}

function init() {
  const loaded = load();
  if (!loaded || !db.users || db.users.length === 0) seed();
}

/* ---------------------------- accessors ---------------------------- */
const Users = {
  all: () => db.users,
  find: (id) => db.users.find(u => u.id === id),
  findByEmail: (email) => db.users.find(u => u.email.toLowerCase() === String(email).toLowerCase()),
  create: (u) => { db.users.push(u); persist(); return u; },
  save: () => persist(),
  applyLevel: (u) => { const lv = levelFromXp(u.xp); u.level = lv.level; return lv; },
};

const Events = {
  all: () => db.events,
  find: (id) => db.events.find(e => e.id === id),
  create: (e) => { db.events.push(e); persist(); return e; },
  save: () => persist(),
};

const Missions = {
  all: () => db.missions,
  find: (id) => db.missions.find(m => m.id === id),
};

const Reports = {
  all: () => db.reports,
  find: (id) => db.reports.find(r => r.id === id),
  create: (r) => { db.reports.push(r); persist(); return r; },
  save: () => persist(),
};

const Guilds = {
  all: () => db.guilds,
  find: (id) => db.guilds.find(g => g.id === id),
};

const Transactions = {
  all: () => db.transactions,
  forUser: (userId) => db.transactions.filter(t => t.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  create: (t) => { db.transactions.push(t); persist(); return t; },
};

const Rewards = {
  all: () => db.rewards,
  find: (id) => db.rewards.find(r => r.id === id),
};

/** Central reward-application helper — writes a Transaction (the ledger) THEN mutates the User. */
function grant(user, { kind, refId = null, xp = 0, greenPoints = 0, co2Kg = 0, note = '' }) {
  const tx = newTransaction({ userId: user.id, kind, refId, xpDelta: xp, greenPointsDelta: greenPoints, co2Kg, note });
  Transactions.create(tx);
  user.xp += xp;
  user.greenPoints += greenPoints;
  user.co2SavedKg = +(user.co2SavedKg + co2Kg).toFixed(2);
  Users.applyLevel(user);
  const today = new Date().toDateString();
  const last = user.lastActionAt ? new Date(user.lastActionAt).toDateString() : null;
  if (last !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    user.streakDays = last === yesterday ? user.streakDays + 1 : 1;
    user.lastActionAt = new Date().toISOString();
  }
  persist();
  return tx;
}


/* ------------------- impact-layer accessors ------------------- */
const Campaigns = {
  all: () => db.campaigns,
  find: (id) => db.campaigns.find(c => c.id === id),
  create: (c) => { db.campaigns.push(c); persist(); return c; },
  save: () => persist(),
};

const Pools = {
  all: () => db.pools,
  find: (id) => db.pools.find(p => p.id === id),
  forEvent: (eventId) => db.pools.filter(p => p.eventId === eventId),
  create: (p) => { db.pools.push(p); persist(); return p; },
  save: () => persist(),
};

const Actions = {
  all: () => db.actions,
  forUser: (userId) => db.actions.filter(a => a.userId === userId),
  forEvent: (eventId) => db.actions.filter(a => a.eventId === eventId),
  create: (a) => { db.actions.push(a); persist(); return a; },
  save: () => persist(),
};

const Certificates = {
  all: () => db.certificates,
  find: (id) => db.certificates.find(c => c.id === id),
  byCode: (code) => db.certificates.find(c => c.code.toUpperCase() === String(code).toUpperCase()),
  forUser: (userId) => db.certificates.filter(c => c.userId === userId),
  create: (c) => { db.certificates.push(c); persist(); return c; },
};

const Goals = {
  all: () => db.goals,
  forEvent: (eventId) => db.goals.find(g => g.eventId === eventId),
  create: (g) => { db.goals.push(g); persist(); return g; },
  save: () => persist(),
};

/**
 * Charges a sponsor campaign for one funded action. Returns null when
 * no active campaign covers this action kind, or when the remaining
 * balance is exhausted — the caller still grants the student their XP,
 * because a student's reward must never depend on sponsor liquidity.
 */
function fundAction({ campaignId = null, kind, co2Kg = 0, userId = null }) {
  const c = campaignId
    ? Campaigns.find(campaignId)
    : db.campaigns.find(x => x.status === 'active' && x.actionKinds.includes(kind));
  if (!c) return null;
  const remaining = c.budgetInr + c.rolledOverInr - c.spentInr;
  if (remaining < c.perActionInr) return null;
  c.spentInr += c.perActionInr;
  c.actionsFunded += 1;
  c.co2AttributedKg = +(c.co2AttributedKg + co2Kg).toFixed(2);
  c.ledger.push({ at: new Date().toISOString(), kind: 'debit', amountInr: c.perActionInr, actions: 1, note: `Funded ${kind}${userId ? ' for ' + userId : ''}` });
  persist();
  return { campaignId: c.id, sponsorName: c.sponsorName, chargedInr: c.perActionInr, remainingInr: c.budgetInr + c.rolledOverInr - c.spentInr };
}

/**
 * The "Green Deposit" rule: when an event closes, whatever the sponsor
 * committed but nobody claimed rolls forward instead of expiring.
 */
function rolloverCampaign(campaignId, note = 'Unclaimed balance rolled to next event') {
  const c = Campaigns.find(campaignId);
  if (!c) return null;
  const unspent = c.budgetInr + c.rolledOverInr - c.spentInr;
  if (unspent <= 0) return { rolledInr: 0 };
  c.rolledOverInr += 0; // balance already carries; we only record the event
  c.ledger.push({ at: new Date().toISOString(), kind: 'rollover', amountInr: unspent, actions: 0, note });
  persist();
  return { rolledInr: unspent };
}


const Mentors = {
  all: () => db.mentors,
  find: (id) => db.mentors.find(m => m.id === id),
  save: () => persist(),
};

const Sessions = {
  all: () => db.sessions,
  find: (id) => db.sessions.find(s => s.id === id),
  forUser: (userId) => db.sessions.filter(s => s.studentId === userId),
  create: (s) => { db.sessions.push(s); persist(); return s; },
  save: () => persist(),
};

module.exports = {
  init, Mentors, Sessions, Users, Events, Missions, Reports, Guilds, Transactions, Rewards, grant,
  Campaigns, Pools, Actions, Certificates, Goals, fundAction, rolloverCampaign, TRUST_TIERS,
};
