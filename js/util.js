// STARTUP shared browser helpers.
export const HOST = 'https://startup-pad.vercel.app';
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const short = a => { a = String(a || ''); return a.length > 10 ? a.slice(0, 4) + '…' + a.slice(-4) : a; };
export function usd(n) {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return '$' + (n / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'K';
  return '$' + n.toFixed(a >= 10 ? 0 : 2);
}
export const pct = n => (n == null || !isFinite(n)) ? '—' : (n > 0 ? '+' : '') + n.toFixed(Math.abs(n) >= 100 ? 0 : 1) + '%';
export const sol = lamports => (lamports == null) ? '—' : (lamports / 1e9).toFixed(lamports >= 1e9 ? 2 : 4) + ' SOL';
export function ago(t) {
  if (!t) return '';
  const s = Math.max(1, (Date.now() - t) / 1000);
  if (s < 60) return Math.floor(s) + 's ago'; if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago';
}
export async function api(path, body, ms = 20000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(path, body === undefined ? { signal: c.signal } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: c.signal });
    const j = await r.json().catch(() => ({ ok: false }));
    if (!r.ok && j.ok !== false) j.ok = false;
    if (j.ok === false && !j.error) j.error = r.status === 429 ? 'Slow down a little and try again.' : 'The server is busy. Try again in a moment.';
    j.status = r.status;
    return j;
  } catch (e) { return { ok: false, error: e.name === 'AbortError' ? 'That took too long. Try again.' : 'Network error. Check your connection.' }; }
  finally { clearTimeout(t); }
}
let healthP = null;
export const health = () => healthP || (healthP = api('/api/health').then(j => j.ok ? j : { ok: false, launch: { open: false }, studio: { engine: null, ledger: false }, art: { engine: 'flux' }, wallets: {} }));
let listP = null;
export const startups = () => listP || (listP = api('/api/startups', undefined, 30000).then(j => (j.ok ? j.startups || [] : null)));
export function toast(msg) {
  let el = $('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.append(el); }
  el.textContent = msg; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 2400);
}
export async function copy(text, label = 'Copied') { try { await navigator.clipboard.writeText(text); toast(label); } catch (e) { toast('Copy failed'); } }
export function reveal(root = document) {
  const els = $$('.reveal:not(.shown)', root);
  if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('shown')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('shown'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  els.forEach(e => io.observe(e));
}
export function nav() {
  const bar = $('.progress i');
  if (bar) { let ticking = false; const upd = () => { const h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`; ticking = false; }; addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true }); upd(); }
  const b = $('.nav .menu'), n = $('.nav nav');
  if (b && n) b.addEventListener('click', () => { const o = n.classList.toggle('open'); b.setAttribute('aria-expanded', o); });
  const here = location.pathname.replace(/\/$/, '') || '/';
  $$('.nav nav a').forEach(a => { if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page'); });
}
export const ROUNDS = [
  { id: 'garage', name: 'Garage', at: 'Launch', blurb: 'Day one. A laptop, a dream and a coin.' },
  { id: 'seed', name: 'Seed', at: '$25K market cap', blurb: 'Out of the garage and into a real office.' },
  { id: 'ipo', name: 'IPO', at: 'Graduates off the curve', blurb: 'Bonds on pump.fun. Rings the bell.' },
  { id: 'unicorn', name: 'Unicorn', at: '$1M market cap', blurb: 'Rooftop office. Everyone wants a meeting.' },
];
export const roundIndex = id => Math.max(0, ROUNDS.findIndex(r => r.id === id));
export const ICONS = {
  garage: '<svg viewBox="0 0 120 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><path d="M14 96V48L60 12l46 36v48"/><path d="M34 96V62h52v34"/><path d="M34 72h52M34 82h52" stroke-width="3"/><circle cx="60" cy="38" r="7"/></svg>',
  seed: '<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><rect x="22" y="30" width="76" height="86" rx="4"/><path d="M38 48h12M70 48h12M38 66h12M70 66h12M38 84h12M70 84h12"/><path d="M52 116V98h16v18"/></svg>',
  ipo: '<svg viewBox="0 0 120 150" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><rect x="26" y="20" width="68" height="126" rx="4"/><path d="M40 38h40M40 56h40M40 74h40M40 92h40M40 110h40" stroke-width="4"/><path d="M60 20V4"/><path d="M60 6l16 6-16 6" stroke-width="4"/></svg>',
  unicorn: '<svg viewBox="0 0 120 170" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><path d="M28 166V44l32-28 32 28v122z"/><path d="M42 60h36M42 78h36M42 96h36M42 114h36M42 132h36" stroke-width="4"/><path d="M60 16V2"/><path d="M60 2l7 13" stroke-width="4"/></svg>',
};
export const FICON = {
  pitch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg>',
  demo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/></svg>',
  live: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4M3.5 3.5a12 12 0 0 0 0 17M20.5 3.5a12 12 0 0 1 0 17"/></svg>',
  update: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
  podcast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/></svg>',
  keynote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="18" height="12" rx="1.5"/><path d="M12 15v6M8 21h8"/></svg>',
  raised: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 17 9 11l4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  hiring: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/></svg>',
  pivot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/></svg>',
  office: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/></svg>',
};
export async function mountHeroCoin(stage, opt = {}) {
  const canvas = stage.querySelector('canvas');
  const fallback = () => { if (canvas) canvas.remove(); if (!stage.querySelector('.fallback')) { const img = new Image(); img.className = 'fallback'; img.alt = ''; img.src = '/assets/coin.png'; stage.prepend(img); } };
  try {
    const t = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    if (!t || !canvas) return fallback();
    const [{ mountCoin }, mark] = await Promise.all([import('/js/coin3d.js'), fetch('/assets/mark.json').then(r => r.json())]);
    const coin = mountCoin(canvas, { mark, ...opt });
    canvas.addEventListener('click', () => coin.burst(14));
    canvas.addEventListener('pointerenter', () => coin.burst(4));
    return coin;
  } catch (e) { fallback(); return null; }
}
export function wordRise(el) {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let i = 0;
  for (const line of el.querySelectorAll('[data-rise]')) {
    const words = line.textContent.trim().split(/\s+/);
    line.innerHTML = words.map(w => `<span class="w" style="animation-delay:${(i++ * 0.07).toFixed(2)}s">${esc(w)}</span>`).join(' ');
  }
}
export function countTo(el, to, ms = 900) {
  if (!el) return; const from = parseFloat(el.dataset.v || '0') || 0; el.dataset.v = to;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || from === to) { el.textContent = Math.round(to).toLocaleString(); return; }
  const t0 = performance.now(); const step = now => { const k = Math.min(1, (now - t0) / ms); const e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(from + (to - from) * e).toLocaleString(); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step);
}
export function shareX(text, url) { return 'https://x.com/intent/post?text=' + encodeURIComponent(text + (url ? '\n' + url : '')); }
export function cardHTML(s, i) {
  const m = s.market || {};
  return `<a class="card hover sc reveal" href="/s/${esc(s.mint)}">
    ${i != null ? `<span class="rank">#${i + 1}</span>` : ''}
    <div class="top">${s.image ? `<img class="logo" src="${esc(s.image)}" alt="" loading="lazy">` : '<span class="logo"></span>'}
      <div style="min-width:0"><div class="nm">${esc(s.name)}</div><div class="tk">$${esc(s.symbol)} · ${esc((ROUNDS[roundIndex(s.round)] || ROUNDS[0]).name)}</div></div></div>
    <p class="tag">${esc(s.tagline || s.description || '')}</p>
    <div class="stats"><div><small>Mkt cap</small><b>${usd(m.mcap)}</b></div><div><small>24h vol</small><b>${usd(m.vol24)}</b></div><div><small>24h</small><b class="${m.chg24 > 0 ? 'lime' : ''}">${pct(m.chg24)}</b></div></div>
    <div class="fd"><i style="${s.founder && s.founder.image ? `background-image:url('${esc(s.founder.image)}')` : ''}"></i>${s.founder && s.founder.name ? esc(s.founder.name) + ' · AI founder' : 'AI founder'} · ${ago(s.t)}</div>
  </a>`;
}
