import { $, $$, esc, api, nav, health, startups, short, toast, FICON } from './util.js';
import { walletsAvailable, connectWallet, signText } from './wallet.js';
nav();
const S = { w: null, mint: new URLSearchParams(location.search).get('mint') || null, fmt: null, formats: [], mine: [], ready: false };
(async () => {
  const [h, f] = await Promise.all([health(), api('/api/studio?formats=1')]);
  const eng = h.studio && h.studio.engine, led = h.studio && h.studio.ledger;
  $('#sEngine').innerHTML = `<span class="dot ${eng ? 'on' : 'off'}"></span>${eng ? 'Higgsfield engine connected' : 'Higgsfield engine not connected yet'}`;
  $('#sLedger').innerHTML = `<span class="dot ${led ? 'on' : 'off'}"></span>${led ? 'Ledger connected' : 'Ledger not connected yet'}`;
  if (h.caps) $('#sCaps').textContent = `Caps: $${h.caps.perStartupDay}/startup/day · $${h.caps.globalDay}/day total`;
  S.ready = !!(eng && led);
  S.formats = (f.ok && f.formats) || [];
  $('#sFormats').innerHTML = S.formats.map(x => `<button class="card fmt" type="button" data-f="${esc(x.id)}" aria-pressed="false"><span class="ico">${FICON[x.id] || ''}</span><h4>${esc(x.name)}</h4><p>${esc(x.blurb)}</p></button>`).join('');
  $$('#sFormats [data-f]').forEach(b => b.addEventListener('click', () => { S.fmt = b.dataset.f; $$('#sFormats [data-f]').forEach(x => x.setAttribute('aria-pressed', x === b)); arm(); }));
  const ws = walletsAvailable();
  $('#sWallets').innerHTML = ws.length ? ws.map(id => `<button class="btn sm" type="button" data-w="${id}">Connect ${id[0].toUpperCase() + id.slice(1)}</button>`).join('') : '<span class="muted">Install Phantom, Solflare or Backpack to use the Studio.</span>';
  $$('#sWallets [data-w]').forEach(b => b.addEventListener('click', async () => {
    try { S.w = await connectWallet(b.dataset.w); b.textContent = S.w.name + ' · ' + short(S.w.address); b.classList.add('lime'); loadMine(); }
    catch (e) { toast(e.message === 'cancelled' ? 'You cancelled the connection.' : 'Could not connect that wallet.'); }
  }));
  $('#mine').innerHTML = '<p class="muted" style="margin:0">Connect the wallet that launched your startup.</p>';
  if (S.mint) videos(S.mint);
  arm();
})();
async function loadMine() {
  $('#mine').innerHTML = '<div class="bar"></div>';
  const all = await startups();
  S.mine = (all || []).filter(s => s.creator === S.w.address);
  if (!S.mine.length) { $('#mine').innerHTML = '<p class="muted" style="margin:0">This wallet hasn\'t launched a startup on STARTUP yet. <a class="lime" href="/launch">Launch one</a></p>'; arm(); return; }
  if (!S.mint || !S.mine.find(s => s.mint === S.mint)) S.mint = S.mine[0].mint;
  $('#mine').innerHTML = S.mine.map(s => `<button type="button" data-m="${esc(s.mint)}" aria-pressed="${s.mint === S.mint}">${s.image ? `<img src="${esc(s.image)}" alt="">` : '<img alt="">'}<span><b>${esc(s.name)}</b><br><span class="muted">$${esc(s.symbol)} · ${esc(s.founder.name || 'AI founder')}</span></span></button>`).join('');
  $$('#mine [data-m]').forEach(b => b.addEventListener('click', () => { S.mint = b.dataset.m; $$('#mine [data-m]').forEach(x => x.setAttribute('aria-pressed', x === b)); videos(S.mint); arm(); }));
  videos(S.mint); arm();
}
function arm() {
  const b = $('#film');
  if (!S.ready) { b.disabled = true; b.textContent = 'Studio opens soon'; return; }
  b.disabled = !(S.w && S.mint && S.fmt && S.mine.length);
  b.textContent = !S.w ? 'Connect your founder wallet' : !S.fmt ? 'Pick a format' : 'Film it';
}
$('#film').addEventListener('click', async () => {
  const b = $('#film'); $('#sErr').textContent = ''; b.disabled = true; b.textContent = 'Sign in your wallet…';
  try {
    const ts = Math.floor(Date.now() / 1000);
    const signature = await signText(S.w.provider, `STARTUP studio\nmint: ${S.mint}\nformat: ${S.fmt}\nts: ${ts}`);
    b.textContent = 'Sending to Higgsfield…';
    const j = await api('/api/studio', { mint: S.mint, format: S.fmt, wallet: S.w.address, ts, signature }, 30000);
    if (!j.ok) throw new Error(j.error);
    poll(j.job.id);
  } catch (e) { $('#sErr').textContent = e.message === 'cancelled' ? 'You cancelled the signature.' : e.message; }
  finally { arm(); }
});
async function poll(id) {
  const box = $('#job');
  for (let i = 0; i < 120; i++) {
    const j = await api('/api/studio?id=' + encodeURIComponent(id));
    const st = j.ok ? j.job.status : 'running';
    box.innerHTML = `<div class="pill ${st === 'done' ? 'lime' : ''}"><span class="dot ${st === 'failed' ? 'off' : 'on'}"></span>${st === 'done' ? 'Ready' : st === 'failed' ? 'Failed' : 'Filming… usually a minute or two'}</div>`;
    if (j.ok && st === 'done') { box.innerHTML += `<video src="${esc(j.job.video)}" controls playsinline autoplay muted loop style="margin-top:12px"></video><p style="margin-top:10px"><a class="btn sm" href="${esc(j.job.video)}" download target="_blank" rel="noopener">Download</a></p>`; videos(S.mint); return; }
    if (j.ok && st === 'failed') { box.innerHTML += `<p class="err">${esc(j.job.error || 'The video engine could not make this one.')}</p>`; return; }
    await new Promise(r => setTimeout(r, 5000));
  }
}
async function videos(mint) {
  const j = await api('/api/studio?mint=' + encodeURIComponent(mint));
  const v = (j.ok && j.videos) || [];
  $('#sVids').innerHTML = v.length ? v.map(x => `<figure><video src="${esc(x.video)}" controls playsinline preload="metadata" muted></video><figcaption>${esc(x.format)} · AI-generated</figcaption></figure>`).join('') : '<p class="muted" style="margin:0">No videos yet.</p>';
}
