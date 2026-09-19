const express = require('express');
const { Rewards, Users, Transactions, Actions, TRUST_TIERS } = require('../data/db');
const { requireAuth } = require('../middleware/auth');
const { newTransaction } = require('../entities/Transaction');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ rewards: Rewards.all() });
});

/**
 * Redeem a reward — the debit half of the GreenPoints economy.
 *
 * Two guards, both deliberate:
 *  1. Balance is checked server-side. The browser is never the
 *     authority on what a student can afford.
 *  2. High-value rewards require evidence. A student whose actions are
 *     all self-reported can still earn and spend on small rewards, but
 *     sponsor-funded items need at least one event-verified action.
 *     Nobody is blocked or accused — the requirement is stated plainly
 *     and is the same for everyone.
 */
const EVIDENCE_REQUIRED_ABOVE = 500;

router.post('/:id/redeem', requireAuth, (req, res) => {
  const reward = Rewards.find(req.params.id);
  if (!reward) return res.status(404).json({ error: 'Reward not found.' });
  if (reward.stock <= 0) return res.status(409).json({ error: 'This reward is out of stock.' });

  const user = Users.find(req.user.id);
  if (user.greenPoints < reward.cost) {
    return res.status(400).json({
      error: `Not enough GreenPoints. This costs ${reward.cost}, your balance is ${user.greenPoints}.`,
      shortfall: reward.cost - user.greenPoints,
    });
  }

  if (reward.cost > EVIDENCE_REQUIRED_ABOVE) {
    const hasVerified = Actions.forUser(user.id).some(a => TRUST_TIERS[a.tier] && TRUST_TIERS[a.tier].canFundReward);
    if (!hasVerified) {
      return res.status(403).json({
        error: 'Rewards above 500 GreenPoints need at least one event-verified action. Check in at an event or join an EcoPool, then try again.',
        reason: 'evidence_required',
      });
    }
  }

  const tx = newTransaction({
    userId: user.id, kind: 'redeem', refId: reward.id,
    xpDelta: 0, greenPointsDelta: -reward.cost, co2Kg: 0,
    note: `Redeemed: ${reward.title} (${reward.sponsor})`,
  });
  Transactions.create(tx);
  user.greenPoints -= reward.cost;
  reward.stock -= 1;
  Users.save();

  const code = 'GG' + Math.random().toString(36).slice(2, 8).toUpperCase();
  res.json({
    transaction: tx,
    redemptionCode: code,
    reward: { id: reward.id, title: reward.title, sponsor: reward.sponsor },
    balance: user.greenPoints,
  });
});

module.exports = router;
