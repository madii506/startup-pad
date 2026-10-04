// STARTUP launch client. The mint key is made here in the browser, the founder's wallet signs both transactions
// in one prompt, and they are sent in order: (1) create the coin (+ dev buy), (2) lock the 30/35/35 fee split.
const B64 = { d: s => Uint8Array.from(atob(s), c => c.charCodeAt(0)), e: u => { let s = ''; const a = new Uint8Array(u); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); } };
const script = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load the Solana library. Check your connection.')); document.head.append(s); });
async function web3() { if (!window.Buffer) await script('/vendor/buffer.min.js'); if (!window.solanaWeb3) await script('/vendor/web3.min.js'); return window.solanaWeb3; }
async function post(url, body, ms = 30000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: c.signal }); const j = await r.json().catch(() => ({})); if (!r.ok && !('result' in j) && !('error' in j)) j.error = j.error || 'The server is busy. Try again.'; return j; }
  catch (e) { return { ok: false, error: e.name === 'AbortError' ? 'That took too long. Try again.' : 'Network error. Try again.' }; }
  finally { clearTimeout(t); }
}
async function rpc(method, params) {
  const j = await post('/api/rpc', { method, params }, 30000);
  if (j.error) throw new Error(typeof j.error === 'string' ? j.error : (j.error.message || 'RPC error'));
  if (!('result' in j)) throw new Error('The Solana relay is busy. Try again.');
  return j.result;
}
function human(e) {
  const m = String(e && (e.message || e) || '');
  if (/cancel|reject|denied|declined|user rejected/i.test(m)) return 'You cancelled it in your wallet.';
  if (/insufficient|0x1\b|not enough|lamports/i.test(m)) return 'Not enough SOL in this wallet for the launch and dev buy.';
  if (/blockhash|expired|block height/i.test(m)) return 'The approval took too long and expired. Try again.';
  if (/no wallet/i.test(m)) return 'Install Phantom, Solflare or Backpack to launch.';
  return m.length < 160 ? m : 'Something went wrong. Nothing was charged unless a transaction link appears above.';
}
async function simulate(tx) {
  const r = await rpc('simulateTransaction', [B64.e(tx.serialize()), { encoding: 'base64', sigVerify: false, replaceRecentBlockhash: true, commitment: 'confirmed' }]);
  const v = r && r.value; if (v && v.err) { const logs = (v.logs || []).join(' '); throw new Error(/insufficient|0x1\b/i.test(logs + JSON.stringify(v.err)) ? 'insufficient' : 'The launch failed its check on Solana (' + JSON.stringify(v.err).slice(0, 80) + ').'); }
  return v;
}
async function send(tx) { return rpc('sendTransaction', [B64.e(tx.serialize()), { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 5 }]); }
async function confirm(sig, secs = 75) {
  for (let i = 0; i < secs / 1.5; i++) {
    await new Promise(r => setTimeout(r, 1500));
    let v; try { const st = await rpc('getSignatureStatuses', [[sig], { searchTransactionHistory: false }]); v = st && st.value && st.value[0]; } catch (e) { continue; }
    if (v && v.err) throw new Error('The transaction failed on Solana.');
    if (v && /confirmed|finalized/.test(v.confirmationStatus || '')) return true;
  }
  return false;
}
const link = sig => `https://solscan.io/tx/${sig}`;

export async function launchStartup({ provider, address, kit, image, founderImage, devBuySol = 0, twitter = '', onStep = () => { } }) {
  const total = 5; let step = 0;
  const tick = String(kit && kit.ticker || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  const say = (text, state = 'run') => onStep(step, total, text, state);
  try {
    step = 1; say('Uploading your startup to pump.fun…');
    const W = await web3();
    const mintKp = W.Keypair.generate(); const mint = mintKp.publicKey.toBase58();
    const b = await post('/api/build', { wallet: address, mint, kit, image, founderImage, devBuySol, twitter }, 60000);
    if (!b.ok) throw new Error(b.error || 'The launch could not be prepared.');
    say('Uploaded. Your coin will be $' + tick + '.', 'ok');
    step = 2; say('Checking the launch on Solana…');
    const txs = b.txs.map(t => W.VersionedTransaction.deserialize(B64.d(t)));
    await simulate(txs[0]);
    say('Looks good.', 'ok');
    step = 3; say('Approve both transactions in your wallet (one prompt).');
    const signed = provider.signAllTransactions ? await provider.signAllTransactions(txs) : [await provider.signTransaction(txs[0]), await provider.signTransaction(txs[1])];
    signed[0].sign([mintKp]);
    say('Approved.', 'ok');
    step = 4; say('Creating $' + tick + ' on pump.fun…');
    const s0 = await send(signed[0]);
    if (!await confirm(s0)) throw new Error(`Not confirmed yet. It may still land: <a href="${link(s0)}" target="_blank" rel="noopener">view the transaction</a>.`);
    say(`$${tick} is live on pump.fun. <a href="${link(s0)}" target="_blank" rel="noopener">tx</a>`, 'ok');
    step = 5; say('Locking the fee split (30% burn · 35% runway · 35% you)…');
    let s1 = null, split = false;
    try { s1 = await send(signed[1]); split = await confirm(s1); } catch (e) { split = false; }
    if (!split) {
      say('The split did not land in time. Approve it once more.', 'run');
      s1 = await finishSplit({ provider, address, mint, founderCid: b.founderCid });
      split = true;
    }
    say(`Split locked. <a href="${link(s1)}" target="_blank" rel="noopener">tx</a>`, 'ok');
    try { sessionStorage.setItem('su:last', JSON.stringify({ mint, founderCid: b.founderCid, t: Date.now() })); } catch (e) { }
    return { mint, sigs: [s0, s1], feeSplit: split, page: '/s/' + mint };
  } catch (e) { say(human(e), 'err'); throw new Error(human(e)); }
}

export async function finishSplit({ provider, address, mint, founderCid = null }) {
  const W = await web3();
  const j = await post('/api/finish', { wallet: address, mint, founderCid }, 30000);
  if (!j.ok) throw new Error(j.error || 'The split could not be prepared.');
  const tx = W.VersionedTransaction.deserialize(B64.d(j.txs[0]));
  await simulate(tx);
  const signed = await provider.signTransaction(tx);
  const sig = await send(signed);
  if (!await confirm(sig)) throw new Error(`Not confirmed yet: <a href="${link(sig)}" target="_blank" rel="noopener">view the transaction</a>.`);
  return sig;
}

export async function distributeFees({ provider, address, mint }) {
  try {
    const W = await web3();
    const j = await post('/api/distribute', { payer: address, mint }, 30000);
    if (!j.ok) throw new Error(j.error || 'The payout could not be prepared.');
    const tx = W.VersionedTransaction.deserialize(B64.d(j.tx));
    await simulate(tx);
    const signed = await provider.signTransaction(tx);
    const sig = await send(signed);
    await confirm(sig);
    return sig;
  } catch (e) { throw new Error(human(e)); }
}
