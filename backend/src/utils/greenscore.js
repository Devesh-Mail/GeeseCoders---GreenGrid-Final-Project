/**
 * GreenScore Engine v2 — deterministic, explainable, versioned.
 * ===============================================================
 * The platform deliberately does NOT ask an LLM "how green is this
 * event?" — that would be an unverifiable black box. Every number
 * here is computed by pure functions from declared inputs, so it is
 * reproducible and can ship as an "Impact Receipt".
 *
 * WHY v2 REPLACED v1.3
 * --------------------
 * v1.3 used a single blended coefficient of 0.32 kg CO2e per person
 * per HOUR. That silently broke long events: a 24-hour hackathon with
 * 300 people scored 5/100 and 2,304 kg, because it charged every
 * attendee a full transport-sized cost 24 times over. Transport is a
 * one-time round-trip cost per attendee — it does not scale with how
 * long you stay. v2 splits impact into five categories and only scales
 * the ones that genuinely depend on duration (energy, food).
 *
 * THE FIVE CATEGORIES
 *   Transport  ~35%  one-time round trip per physical attendee
 *   Energy     ~25%  venue HVAC + lighting + AV, scales with hours
 *   Food       ~15%  per meal served, derived from duration
 *   Waste      ~15%  per physical attendee, one-time
 *   Materials  ~10%  badges, printed certs, signage — one-time
 *
 * HONEST STATEMENT OF PRECISION
 * -----------------------------
 * These coefficients are prototype-grade planning estimates drawn from
 * public averages, NOT audited measurements. They are deliberately
 * exposed in ASSUMPTIONS below (and surfaced through /api/opendata) so
 * anyone can inspect, challenge, or replace them. The correct claim is
 * "estimated impact from a transparent, versioned model", never "we
 * measured this". Every receipt carries modelVersion so a number
 * computed today stays reproducible after the coefficients change.
 */

const MODEL_VERSION = 'greenscore-v2.0';

/* ------------------------------------------------------------------ *
 * ASSUMPTIONS — every magic number in the model lives here, named,
 * sourced and unit-labelled. Nothing below invents a coefficient.
 * ------------------------------------------------------------------ */
const ASSUMPTIONS = {
  transportPerAttendeeKg: {
    value: 2.4,
    unit: 'kg CO2e per physical attendee, round trip',
    basis: 'Blended urban Indian campus commute: mixed two-wheeler/car/bus, ~12 km round trip. One-time cost — does not scale with event duration.',
  },
  energyPerAttendeeHourKg: {
    value: 0.11,
    unit: 'kg CO2e per attendee per hour',
    basis: 'Venue HVAC, lighting and AV load apportioned per occupant, on an Indian grid intensity of ~0.71 kg CO2e/kWh.',
  },
  foodPerMealKg: {
    value: 1.1,
    unit: 'kg CO2e per meal served',
    basis: 'Mixed-menu catered meal average. Meals derived from duration, not billed hourly.',
  },
  wastePerAttendeeKg: {
    value: 0.35,
    unit: 'kg CO2e per physical attendee',
    basis: 'Disposable cups, plates, packaging and general event waste, landfill-weighted.',
  },
  materialsPerAttendeeKg: {
    value: 0.22,
    unit: 'kg CO2e per attendee',
    basis: 'Printed certificates, badges, lanyards, banners and signage, amortised per head.',
  },
  budgetBasePerAttendeeKg: {
    value: 2.0,
    unit: 'kg CO2e per attendee, fixed component',
    basis: 'Covers the unavoidable one-time costs of showing up: a round trip, a badge, some waste.',
  },
  budgetPerAttendeeHourKg: {
    value: 0.15,
    unit: 'kg CO2e per attendee per hour, variable component',
    basis: 'Allowance that grows with event length so a 24h hackathon is judged against 24h expectations, not against a 2h seminar. This is why GreenScore measures how well an event is run for its shape, rather than simply penalising long or large events.',
  },
};

/**
 * Score is computed from the RATIO of actual footprint to the event's
 * own duration-aware budget — not from an absolute per-head number.
 * A 24-hour hackathon and a 2-hour seminar are therefore both able to
 * score 90, by each being well-run for what they are. These anchors
 * map that ratio onto 0-100.
 */
const SCORE_ANCHORS = [
  { ratio: 0.40, score: 100 }, // far under budget
  { ratio: 0.70, score: 90 },
  { ratio: 1.00, score: 72 },  // exactly on budget
  { ratio: 1.50, score: 48 },
  { ratio: 2.20, score: 25 },
  { ratio: 3.50, score: 8 },   // floor
];

/** Venue multipliers applied to the ENERGY category only (not transport). */
const VENUE_ENERGY_FACTOR = {
  auditorium: 1.0,
  'hybrid-lab': 0.75,
  classroom: 0.55,
  outdoor: 0.30,
};

/** Share of registered attendees who physically travel to the venue. */
const MODE_PHYSICAL_SHARE = { offline: 1.0, hybrid: 0.55, online: 0.05 };

/** Checklist actions: the fraction of each category they remove. */
const CHECKLIST_EFFECTS = {
  hybrid:          { label: 'Hybrid participation offered', transport: 0.30, energy: 0.10 },
  publicTransport: { label: 'Public transport / EcoPool incentive', transport: 0.22 },
  reusable:        { label: 'Reusable cups & containers', waste: 0.55, food: 0.05 },
  wasteSeg:        { label: 'Waste segregation & composting', waste: 0.30 },
  digitalCerts:    { label: 'Digital certificates only', materials: 0.70 },
};

/** Meals implied by duration (none under 3h, then roughly one per 5h). */
function mealsFor(durationHrs) {
  if (durationHrs < 3) return 0;
  return Math.max(1, Math.round(durationHrs / 5));
}

/**
 * Seasonal adjustment. Monsoon and peak summer push people out of
 * walking/cycling into motorised transport, and summer raises HVAC
 * load. Small effect, but it makes the model defensible rather than a
 * static table. Month is 1-12; defaults to now. Chennai-calibrated.
 */
function seasonFactors(month, venueType) {
  const m = month || (new Date().getMonth() + 1);
  const outdoor = venueType === 'outdoor';
  if (m >= 6 && m <= 9) {
    return { transport: 1.08, energy: outdoor ? 1.0 : 1.04, label: 'Monsoon — more motorised commuting' };
  }
  if (m >= 4 && m <= 5) {
    return { transport: 1.05, energy: outdoor ? 1.0 : 1.12, label: 'Peak summer — elevated cooling load' };
  }
  return { transport: 1.0, energy: 1.0, label: 'Temperate months — baseline assumptions' };
}

/**
 * The event's own carbon budget: a fixed per-head allowance plus a
 * per-head-per-hour allowance, so longer events get a proportionally
 * larger (but not unlimited) budget.
 */
function budgetFor(attendeeCount, durationHrs) {
  const A = ASSUMPTIONS;
  const perHead = A.budgetBasePerAttendeeKg.value + durationHrs * A.budgetPerAttendeeHourKg.value;
  return { perHeadKg: +perHead.toFixed(2), totalKg: +(perHead * attendeeCount).toFixed(1) };
}

/** Maps footprint/budget ratio onto 0-100, piecewise-linear between anchors. */
function scoreFromRatio(ratio) {
  const a = SCORE_ANCHORS;
  if (ratio <= a[0].ratio) return a[0].score;
  for (let i = 0; i < a.length - 1; i++) {
    const lo = a[i], hi = a[i + 1];
    if (ratio <= hi.ratio) {
      const t = (ratio - lo.ratio) / (hi.ratio - lo.ratio);
      return Math.round(lo.score + t * (hi.score - lo.score));
    }
  }
  return a[a.length - 1].score;
}

/** Computes the five category footprints for a config + checklist. */
function categoryBreakdown({ attendeeCount, durationHrs, mode, venueType, checklist, month }) {
  const A = ASSUMPTIONS;
  const physicalShare = MODE_PHYSICAL_SHARE[mode] ?? 1;
  const physical = attendeeCount * physicalShare;
  const venueF = VENUE_ENERGY_FACTOR[venueType] ?? 1;
  const season = seasonFactors(month, venueType);

  let transport = physical * A.transportPerAttendeeKg.value * season.transport;
  let energy    = attendeeCount * durationHrs * A.energyPerAttendeeHourKg.value * venueF * season.energy;
  let food      = physical * mealsFor(durationHrs) * A.foodPerMealKg.value;
  let waste     = physical * A.wastePerAttendeeKg.value;
  let materials = attendeeCount * A.materialsPerAttendeeKg.value;

  const applied = [];
  Object.entries(CHECKLIST_EFFECTS).forEach(([key, eff]) => {
    if (!checklist || !checklist[key]) return;
    let saved = 0;
    if (eff.transport) { const c = transport * eff.transport; transport -= c; saved += c; }
    if (eff.energy)    { const c = energy    * eff.energy;    energy    -= c; saved += c; }
    if (eff.food)      { const c = food      * eff.food;      food      -= c; saved += c; }
    if (eff.waste)     { const c = waste     * eff.waste;     waste     -= c; saved += c; }
    if (eff.materials) { const c = materials * eff.materials; materials -= c; saved += c; }
    applied.push({ key, label: eff.label, savedKg: +saved.toFixed(1) });
  });

  const r = n => +n.toFixed(1);
  return {
    categories: { transport: r(transport), energy: r(energy), food: r(food), waste: r(waste), materials: r(materials) },
    totalKg: r(transport + energy + food + waste + materials),
    appliedActions: applied,
    physicalAttendees: Math.round(physical),
    meals: mealsFor(durationHrs),
    season: season.label,
  };
}

/**
 * Main entry point. Returns score, CO2e estimate, budget, category
 * split, the counterfactual "do-nothing" baseline, and a
 * confidence/data-quality assessment.
 */
function computeGreenScore({
  attendeeCount = 50, durationHrs = 4, mode = 'offline',
  venueType = 'auditorium', checklist = {}, month = null,
  attendanceIsEstimated = true,
} = {}) {
  const cfg = { attendeeCount, durationHrs, mode, venueType, month };

  const withActions = categoryBreakdown({ ...cfg, checklist });
  // Counterfactual: same event, fully offline, no green measures.
  // This is what "82 vs 41 if nothing were done" compares against —
  // computed, never hardcoded.
  const baseline = categoryBreakdown({ ...cfg, mode: 'offline', checklist: {} });

  const perHead = withActions.totalKg / Math.max(1, attendeeCount);
  const budget = budgetFor(attendeeCount, durationHrs);
  const carbonBudgetKg = budget.totalKg;

  const ratio = withActions.totalKg / Math.max(1, carbonBudgetKg);
  const greenScore = scoreFromRatio(ratio);
  const baselineScore = scoreFromRatio(baseline.totalKg / Math.max(1, carbonBudgetKg));

  const avoidedKg = +(baseline.totalKg - withActions.totalKg).toFixed(1);

  const signals = [];
  if (attendanceIsEstimated) signals.push('Attendance is an organiser estimate, not a verified check-in count.');
  if (!checklist || Object.keys(checklist).filter(k => checklist[k]).length === 0) signals.push('No sustainability actions declared yet.');
  if (durationHrs > 12) signals.push('Long-duration event — overnight energy load is approximated.');
  if (attendeeCount < 15) signals.push('Small sample size increases per-head variance.');
  const confidence = signals.length === 0 ? 'High' : signals.length <= 2 ? 'Medium' : 'Low';

  return {
    modelVersion: MODEL_VERSION,
    greenScore,
    co2EstimateKg: withActions.totalKg,
    perAttendeeKg: +perHead.toFixed(2),
    carbonBudgetKg,
    budgetPerAttendeeKg: budget.perHeadKg,
    budgetRatio: +ratio.toFixed(2),
    overBudgetKg: +Math.max(0, withActions.totalKg - carbonBudgetKg).toFixed(1),
    underBudget: withActions.totalKg <= carbonBudgetKg,
    categories: withActions.categories,
    appliedActions: withActions.appliedActions,
    physicalAttendees: withActions.physicalAttendees,
    meals: withActions.meals,
    season: withActions.season,
    counterfactual: {
      baselineScore,
      baselineCo2Kg: baseline.totalKg,
      avoidedKg,
      improvementPoints: greenScore - baselineScore,
    },
    confidence,
    dataQualityNotes: signals,
  };
}

/** "What-if" simulator — pure calculation, drives the live UI toggles. */
function simulate(baseConfig, checklist) {
  return computeGreenScore(Object.assign({}, baseConfig, { checklist }));
}

/**
 * Ranks not-yet-taken checklist actions by how much CO2e each would
 * remove for THIS event — "enable hybrid, -310 kg" rather than a
 * generic tip list. Deterministic: same event in, same advice out.
 */
function recommendations(config, checklist = {}) {
  const current = computeGreenScore({ ...config, checklist });
  const out = [];
  Object.entries(CHECKLIST_EFFECTS).forEach(([key, eff]) => {
    if (checklist[key]) return;
    const next = computeGreenScore({ ...config, checklist: { ...checklist, [key]: true } });
    out.push({
      key,
      label: eff.label,
      co2SavedKg: +(current.co2EstimateKg - next.co2EstimateKg).toFixed(1),
      scoreGain: next.greenScore - current.greenScore,
    });
  });
  return out.sort((a, b) => b.co2SavedKg - a.co2SavedKg);
}

function levelFromXp(xp) {
  let level = 1, remain = xp, need = 250;
  while (remain >= need) { remain -= need; level++; need = level * 250; }
  return { level, intoLevel: remain, forNextLevel: need };
}

module.exports = {
  MODEL_VERSION, ASSUMPTIONS, CHECKLIST_EFFECTS,
  computeGreenScore, simulate, recommendations, levelFromXp,
};
