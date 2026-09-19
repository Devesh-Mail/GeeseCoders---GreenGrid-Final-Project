/**
 * ENTITY: Mission
 * ---------------------------------------------------------------
 * id            string
 * title         string
 * type          string   "daily" | "event" | "campus"
 * xp            number
 * greenPoints   number
 * co2Kg         number   impact-equivalent value used for the EcoSwap economy
 * eventId       string?  FK -> Event.id, only for type "event"
 * ---------------------------------------------------------------
 * Per-user completion state lives on Transaction, not here — a
 * Mission is a definition; completing it writes a Transaction and
 * bumps User.xp / User.greenPoints / User.co2SavedKg.
 */
function newMission({ title, type = 'daily', xp, greenPoints, co2Kg, eventId = null }) {
  return {
    id: 'm_' + Math.random().toString(36).slice(2, 10),
    title, type, xp, greenPoints, co2Kg, eventId,
  };
}

module.exports = { newMission };
