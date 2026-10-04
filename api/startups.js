// GET /api/startups : every STARTUP launch, read from chain (registry memo + REG key), with live market + split state.
const L = require('./_lib');
const R = require('./_registry');
module.exports = L.wrap(async (req, res) => {
  const startups = await R.list();
  L.send(res, 200, { ok: true, startups, updated: Date.now() }, 'public, s-maxage=20, stale-while-revalidate=60');
});
