// The STARTUP registry, read straight from chain. Every launch's fee-split transaction carries the memo
// "su:v1:<mint>:<founderCid>" and the read-only REG key, so getSignaturesForAddress(REG) lists every startup.
// The founder record (name, headshot, bio, pitch) is a small JSON on IPFS whose CID is in that memo.
const L = require('./_lib');
const C = require('./_cfg');
const K = require('./_chain');

const META = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
const GATEWAYS = ['https://ipfs.io/ipfs/', 'https://dweb.link/ipfs/', 'https://gateway.pinata.cloud/ipfs/'];
const CID = /^[A-Za-z0-9]{40,80}$/;

function parse(tx, sig, t) {
  if (!tx || (tx.meta && tx.meta.err)) return null;
  const logs = (tx.meta && tx.meta.logMessages) || [];
  const hit = logs.map(l => /Memo \(len \d+\): "(su:v1:[^"]+)"/.exec(l)).find(Boolean);
  if (!hit) return null;
  const [, , mint, cid] = hit[1].split(':');
  if (!L.B58.test(mint || '')) return null;
  const keys = (tx.transaction && tx.transaction.message && tx.transaction.message.accountKeys) || [];
  const payer = keys[0] && (keys[0].pubkey || keys[0]);
  return { mint, founderCid: CID.test(cid || '') ? cid : null, creator: String(payer || ''), sig, t: (t || 0) * 1000 };
}
async function getTx(sig) {
  try { return await L.rpc('getTransaction', [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]); } catch (e) { return null; }
}
async function ipfsJson(cid) {
  if (!cid) return null;
  return L.cached('ipfs:' + cid, 6 * 3600e3, async () => {
    for (const g of GATEWAYS) { try { return await L.getJson(g + cid, {}, 6000); } catch (e) { } }
    return null;
  }).catch(() => null);
}
// coin metadata: pump.fun's API first, then the Metaplex account + its IPFS JSON
async function coinMeta(mint) {
  return L.cached('meta:' + mint, 10 * 60e3, async () => {
    try {
      const c = await L.getJson('https://frontend-api-v3.pump.fun/coins/' + mint, { headers: { accept: 'application/json' } }, 6000);
      if (c && c.mint === mint) return { name: c.name, symbol: c.symbol, image: c.image_uri || null, description: c.description || '' };
    } catch (e) { }
    try {
      const X = require('@solana/web3.js');
      const [pda] = X.PublicKey.findProgramAddressSync([Buffer.from('metadata'), new X.PublicKey(META).toBuffer(), new X.PublicKey(mint).toBuffer()], new X.PublicKey(META));
      const a = await L.rpc('getAccountInfo', [pda.toBase58(), { encoding: 'base64' }]);
      if (!a || !a.value) return null;
      const b = Buffer.from(a.value.data[0], 'base64'); let o = 65;
      const str = () => { const n = b.readUInt32LE(o); o += 4; const s = b.slice(o, o + n).toString('utf8').replace(/\0+$/, ''); o += n; return s; };
      const name = str(), symbol = str(), uri = str();
      const cid = /\/ipfs\/([A-Za-z0-9]{40,})/.exec(uri);
      const j = (cid && await ipfsJson(cid[1])) || {};
      return { name: j.name || name, symbol: j.symbol || symbol, image: j.image || null, description: j.description || '' };
    } catch (e) { return null; }
  });
}
// market data for up to 30 mints per call (DexScreener, best pair by liquidity)
async function markets(mints) {
  const out = {};
  for (let i = 0; i < mints.length; i += 30) {
    const part = mints.slice(i, i + 30);
    try {
      const j = await L.getJson('https://api.dexscreener.com/latest/dex/tokens/' + part.join(','), {}, 8000);
      for (const p of (j.pairs || [])) {
        if (p.chainId !== 'solana') continue;
        const m = p.baseToken && p.baseToken.address; if (!part.includes(m)) continue;
        const liq = (p.liquidity && p.liquidity.usd) || 0;
        if (out[m] && out[m]._liq >= liq) continue;
        out[m] = { mcap: p.marketCap ?? p.fdv ?? null, vol24: (p.volume && p.volume.h24) ?? null, chg24: (p.priceChange && p.priceChange.h24) ?? null, price: p.priceUsd ? +p.priceUsd : null, liquidity: liq || null, url: p.url || null, _liq: liq };
      }
    } catch (e) { }
  }
  for (const m in out) delete out[m]._liq;
  return out;
}
function round(mcap, curve) {
  if (mcap != null && mcap >= 1e6) return 'unicorn';
  if (curve && curve.complete) return 'ipo';
  if (mcap != null && mcap >= 25000) return 'seed';
  return 'garage';
}
function splitDescription(d) {
  // description written at launch: "<tagline>\n\nFounder: <name> (AI).\n<solution>\n\nLaunched on STARTUP."
  const first = String(d || '').split('\n')[0].trim();
  return first.slice(0, 120);
}
async function assemble(entries) {
  const mints = entries.map(e => e.mint);
  const [chain, mk, metas, founders] = await Promise.all([
    K.chainState(mints).catch(() => ({})),
    markets(mints),
    Promise.all(mints.map(coinMeta)),
    Promise.all(entries.map(e => ipfsJson(e.founderCid))),
  ]);
  return entries.map((e, i) => {
    const m = metas[i] || {}, f = founders[i] || {}, st = chain[e.mint] || {};
    // founder record = pump.fun IPFS JSON: name = founder, image = headshot, description = compact JSON of the kit
    let x = {}; try { x = JSON.parse(f.description || '{}') || {}; } catch (er) { x = {}; }
    const p = Array.isArray(x.p) ? x.p : [];
    const s = v => String(v || '').slice(0, 200);
    return {
      mint: e.mint, sig: e.sig, t: e.t, creator: e.creator,
      name: m.name || s(x.c) || 'Untitled startup', symbol: m.symbol || f.symbol || '', image: m.image || null,
      description: m.description || '', tagline: s(x.t) || splitDescription(m.description),
      founder: { name: f.name ? s(f.name).slice(0, 40) : null, title: s(x.ti) || 'AI founder & CEO', bio: s(x.b), voice: s(x.v).slice(0, 80), image: f.image || null },
      pitch: { problem: s(p[0]), solution: s(p[1]), whyNow: s(p[2]) },
      split: st.split || null, vault: st.split ? st.vault : null, curve: st.curve ? { progress: st.curve.progress, complete: st.curve.complete } : null,
      market: mk[e.mint] || null,
      round: round(mk[e.mint] ? mk[e.mint].mcap : null, st.curve),
    };
  });
}
async function list() {
  return L.cached('registry:list', 30e3, async () => {
    const sigs = await L.rpc('getSignaturesForAddress', [C.REG, { limit: 200, commitment: 'confirmed' }]);
    const ok = (sigs || []).filter(s => !s.err);
    const txs = [];
    for (let i = 0; i < ok.length; i += 20) txs.push(...await Promise.all(ok.slice(i, i + 20).map(s => getTx(s.signature))));
    const entries = txs.map((tx, i) => parse(tx, ok[i].signature, ok[i].blockTime)).filter(Boolean);
    const seen = new Set();
    const uniq = entries.filter(e => !seen.has(e.mint) && seen.add(e.mint));
    return assemble(uniq);
  });
}
// one startup: its fee-sharing config account's first transaction is the tagged split transaction
async function card(mint) {
  if (!L.B58.test(mint || '')) return null;
  return L.cached('registry:card:' + mint, 20e3, async () => {
    const cfg = K.feeSharingConfigPda(new (require('@solana/web3.js').PublicKey)(mint)).toBase58();
    let before, oldest = null;
    for (let p = 0; p < 3; p++) {
      const s = await L.rpc('getSignaturesForAddress', [cfg, { limit: 1000, before, commitment: 'confirmed' }]);
      if (!s || !s.length) break;
      oldest = s[s.length - 1];
      if (s.length < 1000) break;
      before = oldest.signature;
    }
    if (!oldest) return null;
    const e = parse(await getTx(oldest.signature), oldest.signature, oldest.blockTime);
    if (!e || e.mint !== mint) return null;
    const [c] = await assemble([e]);
    return c;
  });
}
module.exports = { list, card, parse, round, markets, coinMeta, ipfsJson };
