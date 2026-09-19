/**
 * ENTITY: Event
 * ---------------------------------------------------------------
 * id             string   uuid
 * title          string
 * category       string   "Community" | "Workshops" | "Culture" | "Tech" | "Sports"
 * date           string   ISO date
 * location       string
 * organizerId    string   FK -> User.id (role admin)
 * attendeeIds    string[] FK -> User.id
 * attendeeCount  number   convenience counter (>= attendeeIds.length; seed events are pre-populated)
 * durationHrs    number
 * mode           string   "online" | "offline" | "hybrid"
 * venueType      string   "auditorium" | "outdoor" | "classroom" | "hybrid-lab"
 * greenScore     number   0-100, computed by utils/greenscore.js
 * co2EstimateKg  number   computed alongside greenScore
 * carbonBudgetKg number   recommended ceiling, computed from attendeeCount
 * certified      boolean  organizer has been through Green Certification checklist
 * checklist      object   { hybrid, reusable, publicTransport, digitalCerts, wasteSeg }
 * image          string   emoji/label used by the frontend card (no binary assets in this prototype)
 * xpReward       number
 * ---------------------------------------------------------------
 */
function newEvent({
  title, category, date, location, organizerId,
  durationHrs = 4, mode = 'offline', venueType = 'auditorium', attendeeCount = 50,
  checklist = {}
}) {
  return {
    id: 'e_' + Math.random().toString(36).slice(2, 10),
    title,
    category,
    date,
    location,
    organizerId: organizerId || null,
    attendeeIds: [],
    attendeeCount,
    durationHrs,
    mode,
    venueType,
    greenScore: 50,
    co2EstimateKg: 0,
    carbonBudgetKg: 0,
    certified: false,
    checklist: Object.assign({ hybrid: false, reusable: false, publicTransport: false, digitalCerts: false, wasteSeg: false }, checklist),
    xpReward: 60,
    createdAt: new Date().toISOString(),
  };
}

module.exports = { newEvent };
