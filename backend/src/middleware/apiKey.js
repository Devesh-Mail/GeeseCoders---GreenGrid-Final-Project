/**
 * apiKey middleware — every request must carry x-api-key matching
 * GREENGRID_API_KEY from .env. This is a simple shared-secret gate
 * (appropriate for a hackathon demo distinguishing "our frontend" from
 * arbitrary internet traffic) — swap for real per-developer API keys
 * + rate limiting before any production use.
 */
// Falls back to the published demo key (matches .env.example / assets/js/api.js)
// so a fresh clone that forgot to run `cp .env.example .env` still works out
// of the box instead of every /api/* call failing with a 500. Set your own
// GREENGRID_API_KEY in .env to override this for a real deployment.
const DEFAULT_DEMO_KEY = 'gg_demo_9f2c1a7e4b6d0158';
let warned = false;

module.exports = function apiKey(req, res, next) {
  const provided = req.header('x-api-key');
  const expected = process.env.GREENGRID_API_KEY || DEFAULT_DEMO_KEY;
  if (!process.env.GREENGRID_API_KEY && !warned) {
    warned = true;
    console.warn('⚠️  GREENGRID_API_KEY not set in backend/.env — falling back to the demo key. Run `cp .env.example .env` to fix this permanently.');
  }
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: 'Missing or invalid API key. Send it as the x-api-key header.' });
  }
  next();
};
