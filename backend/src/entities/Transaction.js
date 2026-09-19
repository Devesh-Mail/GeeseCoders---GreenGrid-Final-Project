/**
 * ENTITY: Transaction  (the GreenPoints / XP ledger)
 * ---------------------------------------------------------------
 * Every reward the system ever grants is written here first, then
 * applied to the User. This is what makes a GreenScore or a
 * GreenPoints balance a *receipt* instead of a black-box number —
 * admin.html's "Open Data" style views and dashboard.html's
 * "Impact Receipt" panel both read straight from this ledger.
 *
 * id            string
 * userId        string   FK -> User.id
 * kind          string   "mission" | "event_checkin" | "redeem" | "report_resolved" | "referral"
 * refId         string?  FK -> Mission.id / Event.id / Report.id depending on kind
 * xpDelta       number   signed
 * greenPointsDelta number signed
 * co2Kg         number   signed (negative on redemption reversal, if ever needed)
 * note          string   human-readable reason, shown verbatim in the receipt UI
 * createdAt     string   ISO date
 * ---------------------------------------------------------------
 */
function newTransaction({ userId, kind, refId = null, xpDelta = 0, greenPointsDelta = 0, co2Kg = 0, note = '' }) {
  return {
    id: 't_' + Math.random().toString(36).slice(2, 10),
    userId, kind, refId, xpDelta, greenPointsDelta, co2Kg, note,
    createdAt: new Date().toISOString(),
  };
}

module.exports = { newTransaction };
