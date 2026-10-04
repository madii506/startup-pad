// Live pump.fun trades for one coin from PumpPortal's public websocket, with reconnect backoff.
export function tradeFeed(mint, { onTrade, onStatus }) {
  let ws, tries = 0, closed = false, timer;
  function open() {
    if (closed) return;
    try { ws = new WebSocket('wss://pumpportal.fun/api/data'); } catch (e) { return retry(); }
    ws.onopen = () => { tries = 0; onStatus && onStatus('live'); ws.send(JSON.stringify({ method: 'subscribeTokenTrade', keys: [mint] })); };
    ws.onmessage = ev => {
      let d; try { d = JSON.parse(ev.data); } catch (e) { return; }
      if (!d || d.mint !== mint || !d.txType) return;
      if (d.txType === 'buy' || d.txType === 'sell') onTrade({ side: d.txType, sol: Number(d.solAmount) || 0, trader: d.traderPublicKey, mcapSol: Number(d.marketCapSol) || null, sig: d.signature });
    };
    ws.onclose = () => { onStatus && onStatus('offline'); retry(); };
    ws.onerror = () => { try { ws.close(); } catch (e) { } };
  }
  function retry() { if (closed) return; clearTimeout(timer); timer = setTimeout(open, Math.min(30000, 1500 * 2 ** tries++)); }
  open();
  return { close() { closed = true; clearTimeout(timer); try { ws && ws.close(); } catch (e) { } } };
}
// names on pump.fun are anyone's; skip the ones we would not show
export const BAD = /n[i1!]gg|f[a@]gg|r[a@]pe|porn|s[e3]x|nud[e3]|cum\b|dick|c[o0]ck|puss|t[i1]tt|onlyfan|hitler|nazi|kkk|isis|terror|child|loli|cp\b|kill|suicid|slave|retard|whore|slut|fuck|shit|https?:|\.com|t\.me/i;
// every new coin on pump.fun, live (PumpPortal subscribeNewToken)
export function newTokenFeed({ onToken, onStatus }) {
  let ws, tries = 0, closed = false, timer;
  function open() {
    if (closed) return;
    try { ws = new WebSocket('wss://pumpportal.fun/api/data'); } catch (e) { return retry(); }
    ws.onopen = () => { tries = 0; onStatus && onStatus('live'); ws.send(JSON.stringify({ method: 'subscribeNewToken' })); };
    ws.onmessage = ev => { let d; try { d = JSON.parse(ev.data); } catch (e) { return; } if (!d || d.txType !== 'create' || !d.mint) return; if (BAD.test((d.name || '') + ' ' + (d.symbol || ''))) return; onToken({ mint: d.mint, name: String(d.name || '').slice(0, 32), symbol: String(d.symbol || '').slice(0, 10), mcapSol: Number(d.marketCapSol) || null, t: Date.now() }); };
    ws.onclose = () => { onStatus && onStatus('offline'); retry(); };
    ws.onerror = () => { try { ws.close(); } catch (e) { } };
  }
  function retry() { if (closed) return; clearTimeout(timer); timer = setTimeout(open, Math.min(30000, 1500 * 2 ** tries++)); }
  open();
  return { close() { closed = true; clearTimeout(timer); try { ws && ws.close(); } catch (e) { } } };
}
