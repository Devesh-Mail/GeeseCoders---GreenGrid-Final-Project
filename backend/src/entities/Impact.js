/**
 * Entities added in the "Impact Layer" build.
 * ===============================================================
 * These are the shapes behind the five features that take GreenGrid
 * from "gamified sustainability app" (a crowded category) to "impact
 * layer for college events" (an empty one):
 *
 *   Campaign      sponsor funds OUTCOMES, with unspent budget rolling
 *                 forward instead of evaporating (the "Green Deposit")
 *   PoolGroup     EcoPool — students on the same corridor, grouped
 *   VerifiedAction  every claim carries a trust tier, never a binary
 *   Certificate   portable, verifiable proof of participation
 *   EventGoal     a collective target the whole event works toward
 */

/* ------------------------------------------------------------------ *
 * Campaign — the sponsor's "Green Deposit"
 * ------------------------------------------------------------------ *
 * A sponsor pre-commits a budget against a per-action price. Actions
 * that nobody completes do NOT expire: the remaining balance rolls to
 * the next event. That single rule removes the sponsor's biggest
 * objection ("what if turnout is bad and I've wasted the money") and
 * converts one-off sponsorship into a recurring balance relationship.
 */
function newCampaign({
  sponsorName, title, budgetInr, perActionInr = 10,
  actionKinds = ['ecopool', 'reusable', 'public_transport'],
  eventIds = [],
}) {
  return {
    id: 'cmp_' + Math.random().toString(36).slice(2, 10),
    sponsorName,
    title,
    budgetInr,
    perActionInr,
    actionKinds,
    eventIds,
    spentInr: 0,
    rolledOverInr: 0,
    actionsFunded: 0,
    co2AttributedKg: 0,
    studentsReached: 0,
    status: 'active',
    createdAt: new Date().toISOString(),
    ledger: [], // every debit/rollover, so sponsor ROI is auditable
  };
}

/* ------------------------------------------------------------------ *
 * PoolGroup — EcoPool
 * ------------------------------------------------------------------ *
 * Students are matched on a coarse CORRIDOR (e.g. "OMR", "Tambaram"),
 * never an exact home address. Privacy is the reason the corridor is
 * a free-text bucket rather than coordinates: the system only needs to
 * know two people travel the same general direction to the same event.
 */
function newPoolGroup({ eventId, corridor, capacity = 4 }) {
  return {
    id: 'pool_' + Math.random().toString(36).slice(2, 10),
    eventId,
    corridor,
    capacity,
    memberIds: [],
    co2SavedKg: 0,
    status: 'forming',
    createdAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ *
 * VerifiedAction — trust tiers instead of binary anti-cheat
 * ------------------------------------------------------------------ *
 * The honest answer to "what stops someone lying?" is not "we ban
 * them" — it is that a claim's WEIGHT depends on how it was proven.
 * Self-reported actions still earn XP and keep a streak alive, but
 * they carry less weight in impact totals and cannot unlock
 * high-value sponsor rewards. Nobody is accused of anything; the
 * number simply reflects how well it is evidenced.
 */
const TRUST_TIERS = {
  self_reported: { label: 'Self-reported', weight: 0.4, color: 'amber', canFundReward: false },
  event_verified: { label: 'Event-verified', weight: 0.85, color: 'mint', canFundReward: true },
  sensor_verified: { label: 'Sensor/API-verified', weight: 1.0, color: 'cyan', canFundReward: true },
};

function newVerifiedAction({ userId, eventId = null, kind, tier = 'self_reported', rawCo2Kg = 0, note = '' }) {
  const t = TRUST_TIERS[tier] || TRUST_TIERS.self_reported;
  return {
    id: 'va_' + Math.random().toString(36).slice(2, 10),
    userId,
    eventId,
    kind,
    tier,
    trustWeight: t.weight,
    rawCo2Kg: +Number(rawCo2Kg).toFixed(2),
    // What actually counts toward campus totals: the claim, discounted
    // by how well it is evidenced.
    weightedCo2Kg: +(rawCo2Kg * t.weight).toFixed(2),
    note,
    createdAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ *
 * Certificate — portable proof, not just a share card
 * ------------------------------------------------------------------ *
 * Gen Z will post a resume line far more readily than a story sticker
 * for anything that took effort. Every certificate carries a short
 * verify code resolvable at /api/certificates/verify/:code, so a
 * recruiter or organiser can confirm it independently.
 */
function newCertificate({ userId, userName, eventId, eventTitle, actionsCompleted, co2Kg, greenScore }) {
  const code = 'GG-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  return {
    id: 'cert_' + Math.random().toString(36).slice(2, 10),
    code,
    userId,
    userName,
    eventId,
    eventTitle,
    actionsCompleted,
    co2Kg: +Number(co2Kg).toFixed(2),
    greenScore,
    issuedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ *
 * EventGoal — collective target
 * ------------------------------------------------------------------ *
 * Individual leaderboards make sustainability competitive; a shared
 * target makes it cooperative. Everyone who contributed unlocks the
 * reward together when the event hits its number.
 */
function newEventGoal({ eventId, targetCo2Kg, rewardLabel = 'Sponsor reward unlocked for all participants' }) {
  return {
    id: 'goal_' + Math.random().toString(36).slice(2, 10),
    eventId,
    targetCo2Kg,
    currentCo2Kg: 0,
    contributorIds: [],
    rewardLabel,
    achieved: false,
    achievedAt: null,
  };
}

module.exports = {
  newCampaign, newPoolGroup, newVerifiedAction, newCertificate, newEventGoal, TRUST_TIERS,
};
