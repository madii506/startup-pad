// POST /api/build : uploads the startup to pump.fun IPFS and returns the two launch transactions, unsigned.
//   tx 0  pump.fun create (+ optional dev buy), built by PumpPortal; needs the browser-made mint key + the founder's wallet
//   tx 1  fee sharing: 30% burn / 35% runway / 35% founder, admin revoked (locked), tagged for the STARTUP registry
// Nothing here signs anything or ever sees a private key.
const L = require('./_lib');
const C = require('./_cfg');
const K = require('./_chain');

const IMG = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;
const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n);

async function ipfs({ image, name, symbol, description, website, twitter }) {
  const m = IMG.exec(image || '');
  if (!m) throw new Error('image missing');
  const fd = new FormData();
  fd.append('file', new Blob([Buffer.from(m[2], 'base64')], { type: m[1] }), 'image.' + (m[1].split('/')[1] === 'jpeg' ? 'jpg' : m[1].split('/')[1]));
  fd.append('name', name); fd.append('symbol', symbol); fd.append('description', description);
  if (website) fd.append('website', website);
  if (twitter) fd.append('twitter', twitter);
  fd.append('showName', 'true');
  const r = await L.get('https://pump.fun/api/ipfs', { method: 'POST', body: fd }, 25000);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.metadataUri) throw new Error('pump.fun did not accept the upload (' + r.status + ')');
  const cid = /\/ipfs\/([A-Za-z0-9]{40,})/.exec(j.metadataUri);
  return { uri: j.metadataUri, cid: cid ? cid[1] : null, image: j.metadata && j.metadata.image || null };
}

module.exports = L.wrap(async (req, res) => {
  if (req.method !== 'POST') return L.send(res, 405, { ok: false, error: 'POST only' });
  if (!C.launchOpen()) return L.send(res, 503, { ok: false, error: 'Launches open soon.' });
  const b = await L.body(req);
  const wallet = String(b.wallet || ''), mint = String(b.mint || '');
  if (!L.B58.test(wallet) || !L.B58.test(mint)) return L.send(res, 400, { ok: false, error: 'Connect a wallet first.' });
  const k = b.kit || {};
  const name = clip(k.name, 32), symbol = clip(k.ticker, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (name.length < 2 || symbol.length < 2) return L.send(res, 400, { ok: false, error: 'Give the startup a name and a ticker.' });
  if (!IMG.test(b.image || '')) return L.send(res, 400, { ok: false, error: 'Add a logo first.' });
  if (String(b.image).length + String(b.founderImage || '').length > 3.2e6) return L.send(res, 413, { ok: false, error: 'The images are too large. Try again.' });
  const devBuy = Math.max(0, Math.min(5, Number(b.devBuySol) || 0));
  const f = k.founder || {}, p = k.pitch || {};
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'startup-pad.vercel.app').split(',')[0].trim();
  const page = 'https://' + host + '/s/' + mint;
  const twitter = /^https:\/\/(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/?$/.test(String(b.twitter || '')) ? b.twitter : '';

  // 1. founder record (headshot + the kit as compact JSON), so the startup page can be rebuilt from chain + IPFS alone
  let founderCid = null;
  if (IMG.test(b.founderImage || '')) {
    const rec = { c: name, t: clip(k.tagline, 80), ti: clip(f.title, 32) || 'AI founder & CEO', b: clip(f.bio, 160), v: clip(f.voice, 60), p: [clip(p.problem, 140), clip(p.solution, 140), clip(p.whyNow, 140)] };
    try { founderCid = (await ipfs({ image: b.founderImage, name: clip(f.name, 28) || 'AI founder', symbol, description: JSON.stringify(rec), website: page })).cid; }
    catch (e) { founderCid = null; }
  }
  // 2. the coin itself
  const description = [clip(k.tagline, 80), '', 'Founder: ' + (clip(f.name, 28) || 'an AI') + ' (AI).', clip(p.solution, 140), '', 'Launched on STARTUP.'].join('\n').slice(0, 500);
  const coin = await ipfs({ image: b.image, name, symbol, description, website: page, twitter });

  // 3. tx 0: create + dev buy (PumpPortal builds it; the creator is the founder's wallet)
  const r = await L.get('https://pumpportal.fun/api/trade-local', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ publicKey: wallet, action: 'create', tokenMetadata: { name, symbol, uri: coin.uri }, mint, denominatedInSol: 'true', amount: devBuy, slippage: 10, priorityFee: 0.0005, pool: 'pump' }) }, 20000);
  if (!r.ok) return L.send(res, 502, { ok: false, error: 'pump.fun is busy right now. Try again in a minute.' });
  const tx0 = Buffer.from(await r.arrayBuffer()).toString('base64');

  // 4. tx 1: the locked split + registry tag
  const tx1 = await K.splitTx({ founder: wallet, mint, founderCid, blockhash: await K.blockhash() });
  L.send(res, 200, {
    ok: true, mint, metadataUri: coin.uri, imageUrl: coin.image, founderCid, page,
    shares: K.shares(wallet), txs: [tx0, tx1],
    labels: [devBuy > 0 ? `Create $${symbol} on pump.fun + ${devBuy} SOL dev buy` : `Create $${symbol} on pump.fun`, 'Lock the fee split (30% burn · 35% runway · 35% you)'],
  });
});
