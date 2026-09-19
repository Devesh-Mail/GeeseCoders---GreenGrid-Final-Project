/**
 * ENTITY: Guild  (campus "impact action group")
 * ---------------------------------------------------------------
 * id            string
 * name          string
 * memberIds     string[] FK -> User.id
 * co2SavedKg    number   sum of member contributions
 * issuesSolved  number
 * missionsRun   number
 * ---------------------------------------------------------------
 */
function newGuild({ name }) {
  return {
    id: 'g_' + Math.random().toString(36).slice(2, 10),
    name,
    memberIds: [],
    co2SavedKg: 0,
    issuesSolved: 0,
    missionsRun: 0,
  };
}

module.exports = { newGuild };
