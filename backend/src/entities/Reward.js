/**
 * ENTITY: Reward  (GreenPoints wallet catalog item)
 * ---------------------------------------------------------------
 * id          string
 * title       string
 * cost        number   GreenPoints price
 * sponsor     string
 * stock       number
 * ---------------------------------------------------------------
 */
function newReward({ title, cost, sponsor = 'Campus Fund', stock = 999 }) {
  return { id: 'rw_' + Math.random().toString(36).slice(2, 10), title, cost, sponsor, stock };
}

module.exports = { newReward };
