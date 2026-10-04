// POST /api/distribute {payer, mint} : a permissionless payout of a startup's creator fees to its shareholders.
// Anyone can press it; the payer only covers the network fee.
const L = require('./_lib');
const K = require('./_chain');
module.exports = L.wrap(async (req, res) => {
  if (req.method !== 'POST') return L.send(res, 405, { ok: false, error: 'POST only' });
  const b = await L.body(req);
  if (!L.B58.test(String(b.payer || '')) || !L.B58.test(String(b.mint || ''))) return L.send(res, 400, { ok: false, error: 'Connect a wallet first.' });
  const st = (await K.chainState([b.mint]))[b.mint] || {};
  if (!st.split) return L.send(res, 404, { ok: false, error: 'This coin has no fee split yet.' });
  try {
    const tx = await K.payoutTx({ payer: b.payer, mint: b.mint });
    L.send(res, 200, { ok: true, tx, vault: st.vault });
  } catch (e) {
    L.send(res, 409, { ok: false, error: /nothing/.test(e.message) ? 'Nothing to pay out yet.' : 'The payout could not be built right now.' });
  }
});
