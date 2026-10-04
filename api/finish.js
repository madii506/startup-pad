// POST /api/finish {wallet, mint, founderCid?} : rebuilds the fee-split transaction for a coin whose split never landed.
// Only the coin's creator can sign it, and pump.fun refuses it once a split exists.
const L = require('./_lib');
const C = require('./_cfg');
const K = require('./_chain');
const W = require('@solana/web3.js');
module.exports = L.wrap(async (req, res) => {
  if (req.method !== 'POST') return L.send(res, 405, { ok: false, error: 'POST only' });
  if (!C.launchOpen()) return L.send(res, 503, { ok: false, error: 'Launches open soon.' });
  const b = await L.body(req);
  const wallet = String(b.wallet || ''), mint = String(b.mint || '');
  if (!L.B58.test(wallet) || !L.B58.test(mint)) return L.send(res, 400, { ok: false, error: 'Connect the wallet that launched this coin.' });
  const m = new W.PublicKey(mint);
  const acc = await L.rpc('getMultipleAccounts', [[K.bondingCurvePda(m).toBase58(), K.feeSharingConfigPda(m).toBase58()], { encoding: 'base64', commitment: 'confirmed' }]);
  const [curve, cfg] = acc.value || [];
  if (!curve) return L.send(res, 404, { ok: false, error: 'This coin is not on pump.fun yet. Wait for the launch to confirm.' });
  if (cfg) return L.send(res, 409, { ok: false, error: 'This coin already has its fee split.' });
  const c = K.decodeCurve(curve.data[0]);
  if (!c || c.creator !== wallet) return L.send(res, 403, { ok: false, error: 'Only the wallet that launched this coin can lock its split.' });
  const cid = /^[A-Za-z0-9]{40,80}$/.test(String(b.founderCid || '')) ? String(b.founderCid) : null;
  const tx = await K.splitTx({ founder: wallet, mint, founderCid: cid, blockhash: await K.blockhash() });
  L.send(res, 200, { ok: true, txs: [tx], shares: K.shares(wallet) });
});
