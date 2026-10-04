// GET /api/startup?mint= : one STARTUP launch (404 if this mint was not launched through STARTUP).
const L = require('./_lib');
const R = require('./_registry');
module.exports = L.wrap(async (req, res) => {
  const mint = String((req.query && req.query.mint) || new URL(req.url, 'http://x').searchParams.get('mint') || '');
  if (!L.B58.test(mint)) return L.send(res, 400, { ok: false, error: 'That is not a coin address.' });
  const startup = await R.card(mint);
  if (!startup) return L.send(res, 404, { ok: false, error: 'This coin was not launched on STARTUP.' }, 'public, s-maxage=15');
  L.send(res, 200, { ok: true, startup }, 'public, s-maxage=15, stale-while-revalidate=45');
});
