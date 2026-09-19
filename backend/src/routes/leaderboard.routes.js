const express = require('express');
const { Users, Guilds } = require('../data/db');

const router = express.Router();

router.get('/', (req, res) => {
  const ranked = Users.all()
    .filter(u => u.role === 'student')
    .slice()
    .sort((a, b) => b.xp - a.xp)
    .map((u, i) => ({
      rank: i + 1, name: u.name, xp: u.xp, level: u.level,
      co2SavedKg: u.co2SavedKg, reportsFiled: u.reportsFiled,
      guild: u.guildId ? Guilds.find(u.guildId)?.name : null,
    }));
  res.json({ leaderboard: ranked });
});

router.get('/guilds', (req, res) => {
  res.json({ guilds: Guilds.all().map(g => ({ ...g, memberCount: g.memberIds.length })) });
});

module.exports = router;
