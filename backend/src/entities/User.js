/**
 * ENTITY: User
 * ---------------------------------------------------------------
 * id            string   uuid, primary key
 * name          string
 * email         string   unique
 * passwordHash  string   bcrypt hash (never return this to clients)
 * role          string   "student" | "admin"
 * campus        string
 * xp            number   progression currency
 * level         number   derived from xp (see utils/greenscore.js -> levelFromXp)
 * greenPoints   number   utility/reward currency (separate from XP)
 * co2SavedKg    number   running total, estimated
 * streakDays    number   consecutive days with >=1 completed eco action
 * lastActionAt  string   ISO date of last streak-qualifying action
 * guildId       string   FK -> Guild.id (nullable)
 * badges        string[] badge ids unlocked
 * reportsFiled  number
 * createdAt     string   ISO date
 * ---------------------------------------------------------------
 * This project keeps entities as plain factory functions backed by
 * an in-memory + JSON-file store (see data/db.js) so the hackathon
 * demo runs with zero external services. Swap `db.js` for a real
 * MongoDB/Postgres client later — every route only talks to db.js,
 * never to the storage format directly, so the swap is contained.
 */
function newUser({ name, email, passwordHash, role = 'student', campus = 'St. Joseph\'s Institute of Technology' }) {
  return {
    id: 'u_' + Math.random().toString(36).slice(2, 10),
    name,
    email,
    passwordHash,
    role,
    campus,
    xp: 0,
    level: 1,
    greenPoints: 0,
    co2SavedKg: 0,
    streakDays: 0,
    lastActionAt: null,
    guildId: null,
    badges: [],
    reportsFiled: 0,
    createdAt: new Date().toISOString(),
  };
}

module.exports = { newUser };
