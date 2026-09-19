/**
 * ENTITY: Report  (civic / environmental issue report)
 * ---------------------------------------------------------------
 * id            string
 * title         string
 * category      string   e.g. "Waste", "Water", "Infrastructure", "Other"
 * location      string   campus zone, e.g. "Block A", "Cafeteria"
 * description   string
 * reporterId    string   FK -> User.id
 * status        string   "submitted" | "analyzed" | "assigned" | "resolved" | "verified"
 * ai            object   { urgency, impact, responsibleTeam, confidence, summary, clusterId }
 * clusterId     string?  set when the AI router detects related reports (see utils/ai-router.js)
 * createdAt     string   ISO date
 * resolvedAt    string?  ISO date
 * ---------------------------------------------------------------
 */
function newReport({ title, category, location, description, reporterId }) {
  return {
    id: 'r_' + Math.random().toString(36).slice(2, 10),
    title, category, location, description, reporterId,
    status: 'submitted',
    ai: null,
    clusterId: null,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
}

module.exports = { newReport };
