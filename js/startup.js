import { $, $$, esc, api, nav, usd, pct, sol, short, copy, toast, shareX, ROUNDS, ICONS, roundIndex } from './util.js';
import { makeFeed, founderLine } from './founder.js';
import { tradeFeed } from './feed.js';
nav();
const mint = (location.pathname.split('/')[2] || new URLSearchParams(location.search).get('mint') || '').trim();
function missing(msg) { $('.sp-hero').hidden = true; $('.sp-grid').hidden = true; $('#missing').hidden = false; $('#missingP').textContent = msg; document.title = 'STARTUP · Not found'; }
(async () => {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return missing('That is not a coin address.');
  const j = await api('/api/startup?mint=' + encodeURIComponent(mint), undefined, 30000);
  if (!j.ok) return missing(j.status === 404 ? 'This coin was not launched on STARTUP.' : j.error);
  const s = j.startup, m = s.market || {};
  document.title = `${s.name} ($${s.symbol}) · STARTUP`;
  if (s.image) $('#spLogo').src = s.image;
  $('#spName').textContent = s.name; $('#spTick').textContent = `$${s.symbol} · ${ROUNDS[roundIndex(s.round)].name} round`;
  $('#spTag').textContent = s.tagline || '';
  const url = location.origin + '/s/' + s.mint;
  $('#spActs').innerHTML = `<a class="btn lime" href="https://pump.fun/coin/${esc(s.mint)}" target="_blank" rel="noopener">Buy on pump.fun</a><a class="btn" href="${esc(m.url || 'https://dexscreener.com/solana/' + s.mint)}" target="_blank" rel="noopener">Chart</a><button class="btn" type="button" id="cpy">Copy CA</button><a class="btn" href="${shareX(`${s.name} ($${s.symbol}) — an AI startup with its own token. Founder: ${s.founder.name || 'AI'}.`, url)}" target="_blank" rel="noopener">Share</a>`;
  $('#cpy').addEventListener('click', () => copy(s.mint, 'Contract address copied'));
  $('#kMcap').textContent = usd(m.mcap); $('#kVol').textContent = usd(m.vol24); $('#kRound').textContent = ROUNDS[roundIndex(s.round)].name;
  if (s.curve) { $('#kCurveL').textContent = s.curve.complete ? 'Graduated' : 'Bonding curve'; $('#kCurve').textContent = Math.round(s.curve.progress * 100) + '%'; requestAnimationFrame(() => $('#kMeter').style.width = (s.curve.progress * 100).toFixed(1) + '%'); }
  // founder
  $('#fHs').src = s.founder.image || '/assets/fav-180.png'; $('#fHs').alt = (s.founder.name || 'AI founder') + ', AI-generated founder';
  $('#fName').textContent = s.founder.name || 'AI founder'; $('#fTitle').textContent = s.founder.title || 'AI founder & CEO'; $('#fBio').textContent = s.founder.bio || '';
  $('#pitch').innerHTML = [['Problem', s.pitch.problem], ['Solution', s.pitch.solution], ['Why now', s.pitch.whyNow]].filter(x => x[1]).map(([a, b]) => `<div><b>${a}</b>${esc(b)}</div>`).join('') || `<div>${esc(s.description || '')}</div>`;
  // rounds
  const at = roundIndex(s.round);
  $('#spLadder').innerHTML = ROUNDS.map((r, i) => `<div style="display:flex;gap:14px;align-items:center;padding:10px 12px;border-radius:12px;border:1px solid ${i === at ? 'rgba(209,254,23,.6)' : 'var(--line)'};background:${i === at ? 'var(--limedim)' : 'transparent'}"><span style="width:38px;height:38px;color:${i <= at ? 'var(--lime)' : '#474b51'}">${ICONS[r.id]}</span><div style="flex:1"><b>${r.name}</b><div class="muted" style="font-size:13px">${r.at}</div></div><span class="pill ${i === at ? 'lime' : ''}">${i < at ? 'done' : i === at ? 'here now' : 'locked'}</span></div>`).join('');
  // split
  const sp = s.split;
  $('#lock').innerHTML = sp ? `<span class="dot ${sp.locked ? 'on' : 'off'}"></span>${sp.locked ? 'Locked on-chain' : 'Not locked'}` : '<span class="dot off"></span>No split found';
  $('#splitTbl tbody').innerHTML = sp ? sp.shares.map(r => `<tr><td>${esc(r.role === 'burn' ? 'Burn rate' : r.role === 'runway' ? 'Runway' : r.role === 'founder' ? 'Founder' : r.role)}</td><td class="mono"><a href="https://solscan.io/account/${esc(r.address)}" target="_blank" rel="noopener">${esc(short(r.address))}</a></td><td>${(r.bps / 100).toFixed(0)}%</td></tr>`).join('') : '<tr><td colspan="3" class="muted">No split on chain.</td></tr>';
  $('#vault').textContent = s.vault != null ? sol(s.vault) : '—';
  $('#payout').disabled = !sp || !s.vault;
  $('#payout').addEventListener('click', async () => {
    const b = $('#payout'); b.disabled = true; b.textContent = 'Paying out…';
    try { const { connectWallet } = await import('./wallet.js'); const w = await connectWallet(); const { distributeFees } = await import('./launchtx.js'); const sig = await distributeFees({ provider: w.provider, address: w.address, mint: s.mint }); toast('Paid out'); b.textContent = 'Paid out'; $('#vault').innerHTML = `<a href="https://solscan.io/tx/${esc(sig)}" target="_blank" rel="noopener">0 SOL · tx</a>`; }
    catch (e) { toast(e.message === 'no wallet' ? 'Install Phantom, Solflare or Backpack.' : e.message === 'cancelled' ? 'You cancelled it.' : e.message); b.disabled = false; b.textContent = 'Pay out fees'; }
  });
  // founder feed + live trades
  const feed = makeFeed($('#feed'), { name: s.founder.name, image: s.founder.image });
  const ctx = extra => ({ name: s.name, symbol: s.symbol, tagline: s.tagline, founder: s.founder, round: s.round, ...extra });
  feed.say(await founderLine('hello', ctx()));
  let lastTalk = 0;
  tradeFeed(s.mint, {
    onStatus: st => { $('#feedState').innerHTML = `<span class="dot ${st === 'live' ? 'on' : 'off'}"></span>${st === 'live' ? 'Live trades' : 'Feed offline, reconnecting'}`; },
    onTrade: async t => {
      feed.trade(t.side, t.sol, t.trader);
      if (Date.now() - lastTalk < 8000) return; lastTalk = Date.now();
      const kind = t.side === 'buy' ? (t.sol >= 2 ? 'big' : 'buy') : 'sell';
      feed.say(await founderLine(kind, ctx({ sol: t.sol })));
    },
  });
  setInterval(async () => { if (Date.now() - lastTalk > 45000) { lastTalk = Date.now(); feed.say(await founderLine('idle', ctx())); } }, 15000);
  // studio videos
  const v = await api('/api/studio?mint=' + encodeURIComponent(s.mint));
  const vids = (v.ok && v.videos) || [];
  $('#vids').innerHTML = vids.length ? `<div class="vids">${vids.map(x => `<figure><video src="${esc(x.video)}" controls playsinline preload="metadata" muted></video><figcaption>${esc(x.format)} · AI-generated</figcaption></figure>`).join('')}</div>` : `<p class="muted" style="margin:0">No videos yet. The founder wallet can film the first one in the Studio.</p>`;
  $('#toStudio').href = '/studio?mint=' + encodeURIComponent(s.mint);
})();
