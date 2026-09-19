/**
 * AI Issue Router — deterministic keyword + location classifier.
 * ---------------------------------------------------------------
 * IMPORTANT / HONEST LABELING: this is local, deterministic routing
 * logic, not a call to a hosted LLM. That's intentional for a
 * hackathon prototype (reliable, explainable, zero API cost/latency)
 * and is surfaced to the user as such in the UI ("AI Analysis —
 * local model"). Swap `classify()` for a real model call later
 * without touching any route code — everything imports this module.
 */
const CATEGORY_KEYWORDS = {
  Waste: ['garbage', 'trash', 'waste', 'plastic', 'litter', 'bin', 'overflow', 'dump'],
  Water: ['leak', 'tap', 'water', 'flood', 'drain', 'pipe'],
  Infrastructure: ['broken', 'crack', 'wiring', 'light', 'electricity', 'door', 'fan', 'ac', 'infrastructure', 'road'],
  Energy: ['power', 'electricity', 'energy', 'meter', 'transformer'],
};

const TEAM_BY_CATEGORY = {
  Waste: 'Campus Maintenance',
  Water: 'Plumbing & Utilities',
  Infrastructure: 'Facilities Management',
  Energy: 'Electrical Services',
  Other: 'General Administration',
};

function classifyCategory(text) {
  const lower = text.toLowerCase();
  let best = 'Other', bestHits = 0;
  Object.entries(CATEGORY_KEYWORDS).forEach(([cat, words]) => {
    const hits = words.filter(w => lower.includes(w)).length;
    if (hits > bestHits) { best = cat; bestHits = hits; }
  });
  return { category: best, hits: bestHits };
}

function urgencyFromText(text, hits) {
  const lower = text.toLowerCase();
  const highSignals = ['overflow', 'danger', 'hazard', 'urgent', 'flood', 'exposed', 'spark'];
  if (highSignals.some(s => lower.includes(s)) || hits >= 3) return 'HIGH';
  if (hits >= 1) return 'MEDIUM';
  return 'LOW';
}

/** Very light similarity check for duplicate/related-issue clustering (word overlap on title+location). */
function similarity(a, b) {
  const norm = s => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean));
  const A = norm(a), B = norm(b);
  const inter = [...A].filter(x => B.has(x)).length;
  const union = new Set([...A, ...B]).size || 1;
  return inter / union;
}

/**
 * classify(report, existingReports) -> analysis object
 * Also looks for related open reports (same location + similar text)
 * to power "duplicate/related issue clustering".
 */
function classify(report, existingReports = []) {
  const text = `${report.title} ${report.description}`;
  const { category, hits } = classifyCategory(text);
  const urgency = urgencyFromText(text, hits);
  const confidence = Math.min(97, 58 + hits * 11 + (report.location ? 6 : 0));

  const related = existingReports.filter(r =>
    r.id !== report.id &&
    r.status !== 'resolved' &&
    r.location?.toLowerCase() === report.location?.toLowerCase() &&
    similarity(`${r.title} ${r.description}`, text) > 0.18
  );

  let clusterId = null;
  if (related.length > 0) {
    clusterId = related[0].clusterId || 'incident_' + related[0].id;
  }

  return {
    category,
    urgency,
    impact: category === 'Waste' || category === 'Water' ? 'Environmental + Campus Health' : 'Operational',
    responsibleTeam: TEAM_BY_CATEGORY[category] || TEAM_BY_CATEGORY.Other,
    confidence,
    summary: `${category} issue reported at ${report.location || 'an unspecified location'}. Local model detected ${hits} matching signal(s).`,
    engine: 'local-deterministic-router',
    clusterId,
    relatedCount: related.length,
  };
}

module.exports = { classify, similarity };
