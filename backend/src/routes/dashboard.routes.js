const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { Users, Events, Transactions, Guilds } = require('../data/db');
const { levelFromXp } = require('../utils/greenscore');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const u = req.user;
  const lv = levelFromXp(u.xp);
  const guild = u.guildId ? Guilds.find(u.guildId) : null;
  const allUsers = Users.all().slice().sort((a, b) => b.xp - a.xp);
  const rank = allUsers.findIndex(x => x.id === u.id) + 1;

  const upcoming = Events.all()
    .filter(e => new Date(e.date) > new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3)
    .map(e => ({ id: e.id, title: e.title, greenScore: e.greenScore, xpReward: e.xpReward, date: e.date, location: e.location }));

  const receipts = Transactions.forUser(u.id).slice(0, 6);

  const campus = {
    studentsParticipating: Users.all().length + 1838, // seed dataset baseline + registered demo users
    greenEvents: Events.all().filter(e => e.certified).length + 41,
    co2AvoidedTonnes: 1.7,
    ecoActions: Transactions.all().filter(t => t.kind === 'mission').length + 8420,
  };

  res.json({
    user: { name: u.name, xp: u.xp, level: lv.level, intoLevel: lv.intoLevel, forNextLevel: lv.forNextLevel,
      greenPoints: u.greenPoints, co2SavedKg: u.co2SavedKg, streakDays: u.streakDays, rank, reportsFiled: u.reportsFiled, badges: u.badges },
    guild: guild ? { name: guild.name, co2SavedKg: guild.co2SavedKg, issuesSolved: guild.issuesSolved } : null,
    upcoming,
    receipts,
    campus,
  });
});

module.exports = router;
