import { $, $$, esc, api, nav, health, short, sol, ago } from './util.js';
nav();
if ($('.docs')) {
  health().then(h => {
    const w = h.wallets || {};
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v || 'not set yet'; };
    set('#aReg', h.reg); set('#regKey', h.reg); set('#aBurn', w.burn); set('#aRun', w.runway); set('#aMint', h.startupMint);
  });
  api('/api/burns').then(b => {
    const el = $('#burns'); if (!el) return;
    if (!b.ok || !b.wallet) { el.innerHTML = '<p class="muted" style="margin:0">The burn wallet is not set yet.</p>'; return; }
    el.innerHTML = `<p style="margin:0 0 10px">Burn wallet <span class="mono">${esc(short(b.wallet))}</span> · balance ${sol(b.sol)}</p>` + (b.burns.length ? `<table class="tbl"><tbody>${b.burns.map(x => `<tr><td>${ago(x.t)}</td><td class="mono"><a href="https://solscan.io/tx/${esc(x.sig)}" target="_blank" rel="noopener">${esc(short(x.sig))}</a></td><td>${x.amount.toLocaleString()} $STARTUP</td></tr>`).join('')}</tbody></table>` : '<p class="muted" style="margin:0">No burns yet.</p>');
  });
  const links = $$('.docs aside a');
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-30% 0px -60% 0px' });
  $$('.docs article section').forEach(s => io.observe(s));
}
