// STARTUP API helpers: fetch with timeouts, JSON replies, a Solana RPC with fallbacks, a small in-memory cache.
const RPCS = [process.env.RPC_URL, 'https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'].filter(Boolean);
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
async function get(url, opt = {}, ms = 9000) { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); try { return await fetch(url, { ...opt, signal: c.signal }); } finally { clearTimeout(t); } }
async function getJson(url, opt, ms) { const r = await get(url, opt, ms); if (!r.ok) throw new Error(url.split('?')[0].split('/').slice(2, 4).join('/') + ' ' + r.status); return r.json(); }
function send(res, code, body, cache) { res.setHeader('Cache-Control', cache || 'no-store'); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.status(code).send(JSON.stringify(body)); }
function wrap(fn) { return async (req, res) => { try { await fn(req, res); } catch (e) { send(res, 502, { ok: false, error: String(e && e.message || e).slice(0, 240) }); } }; }
async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return await new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch (e) { r({}); } }); });
}
async function rpc(method, params, ms = 12000) {
  let last;
  for (const url of RPCS) {
    try { const r = await get(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }, ms); const j = await r.json(); if (j.error) { last = new Error(j.error.message); if (/not found|invalid/i.test(j.error.message)) throw last; continue; } return j.result; }
    catch (e) { last = e; }
  }
  throw last || new Error('rpc failed');
}
const mem = {}; async function cached(key, ms, fn) { const c = mem[key]; if (c && Date.now() - c.t < ms) return c.v; const v = await fn(); mem[key] = { t: Date.now(), v }; return v; }
// Jupiter token search: one mint, a comma list of mints, or one symbol/name.
async function jup(query) { return getJson('https://lite-api.jup.ag/tokens/v2/search?query=' + encodeURIComponent(query), {}, 8000); }
function tok(t) { return t && { mint: t.id, name: t.name, symbol: String(t.symbol ?? '').replace(/^\$+/, ''), icon: t.icon || null, mcap: t.mcap ?? t.fdv ?? null, price: t.usdPrice ?? null, holders: t.holderCount ?? null, liq: t.liquidity ?? null, verified: !!t.isVerified, pad: t.launchpad || null, chg: t.stats24h ? t.stats24h.priceChange : null, vol: t.stats24h ? ((t.stats24h.buyVolume || 0) + (t.stats24h.sellVolume || 0)) : null }; }
module.exports = { get, getJson, send, wrap, body, rpc, cached, jup, tok, B58 };
