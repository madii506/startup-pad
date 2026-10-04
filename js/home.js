import { $, $$, esc, api, health, startups, reveal, nav, mountHeroCoin, wordRise, ROUNDS, ICONS, FICON, cardHTML, usd, pct, toast, countTo } from './util.js';
import { newTokenFeed } from './feed.js';
import { makeFeed, founderLine } from './founder.js';
nav(); wordRise($('#h1'));
mountHeroCoin($('#stage'));
const IDEAS = ['Tinder for houseplants', 'An AI that negotiates your rent', 'Uber for dog walkers on the moon', 'A CRM for your situationships', 'LinkedIn but everyone is honest', 'Spotify for silence', 'An AI intern that never sleeps', 'Duolingo for crypto slang', 'Airbnb for parking spots', 'A coffee subscription for coders'];
$('#ideaChips').innerHTML = IDEAS.slice(0, 5).map(i => `<button class="chip" type="button">${esc(i)}</button>`).join('');
$$('#ideaChips .chip').forEach(c => c.addEventListener('click', () => { $('#idea').value = c.textContent; $('#idea').focus(); }));
$('#ideaForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#idea').value.trim(); location.href = '/launch' + (v ? '?idea=' + encodeURIComponent(v) : ''); });
const it = IDEAS.concat(IDEAS).map(i => `<span class="tick">“${esc(i)}”</span>`).join('');
$('#ideaTrack').innerHTML = it;

// live strip + demo day (real launches only) + the market right now
const track = $('#liveTrack'), lbl = $('#live .lbl');
let pumpMode = false; const seen = [];
startups().then(list => {
  countTo($('#nStart'), list ? list.length : 0);
  if (list && list.length) {
    const items = list.slice(0, 24).map(s => { const c = s.market && s.market.chg24; return `<a class="tick" href="/s/${esc(s.mint)}">${s.image ? `<img src="${esc(s.image)}" alt="">` : '<span class="ph"></span>'}<b>$${esc(s.symbol)}</b><span class="muted">${esc(s.name)}</span>${s.market ? `<span>${usd(s.market.mcap)}</span><span class="${c > 0 ? 'up' : c < 0 ? 'down' : ''}">${pct(c)}</span>` : ''}</a>`; }).join('');
    track.innerHTML = `<div class="track">${items}${items}</div>`;
  } else {
    pumpMode = true;
    lbl.innerHTML = '<span class="pill" style="padding:0;border:0;background:none"><span class="dot on"></span></span>New on pump.fun · live';
    track.innerHTML = `<div class="livefeed" id="lf"><span class="tick" style="border-style:dashed;color:var(--soft)">${list ? 'No startups on STARTUP yet. These are coins launching on pump.fun right now.' : 'Watching pump.fun live…'} <a class="lime" href="/launch" style="font-weight:700">Make yours a startup →</a></span></div>`;
    seen.slice(-8).forEach(addTick);
  }
  const top = (list || []).slice().sort((a, b) => ((b.market && b.market.vol24) || 0) - ((a.market && a.market.vol24) || 0)).slice(0, 6);
  $('#top').innerHTML = top.length ? top.map((s, i) => cardHTML(s, i)).join('') : `<div class="empty-state" style="grid-column:1/-1"><h3>Demo Day is empty</h3><p>No startups have launched yet. The first one gets the whole stage.</p><a class="btn lime" href="/launch">Launch the first startup</a></div>`;
  reveal($('#top'));
});
function addTick(t) {
  const lf = $('#lf'); if (!lf) return;
  const el = document.createElement('span'); el.className = 'tick new';
  el.innerHTML = `<span class="ph"></span><b>$${esc(t.symbol || '???')}</b><span class="muted">${esc(t.name)}</span><span class="now">just now</span>`;
  const first = lf.children[1]; lf.insertBefore(el, first || null);
  while (lf.children.length > 16) lf.lastChild.remove();
}
const stamps = [];
newTokenFeed({
  onStatus: st => { $('#lDot').className = 'dot ' + (st === 'live' ? 'on' : 'off'); },
  onToken: t => { stamps.push(t.t); seen.push(t); if (seen.length > 40) seen.shift(); if (pumpMode) addTick(t); },
});
setInterval(() => { const now = Date.now(); while (stamps.length && now - stamps[0] > 60000) stamps.shift(); countTo($('#lpm'), stamps.length, 500); }, 2000);

// hero parallax (transform only, rAF-throttled)
const stage = $('#stage');
if (stage && !matchMedia('(prefers-reduced-motion: reduce)').matches) { let tk = false; addEventListener('scroll', () => { if (tk) return; tk = true; requestAnimationFrame(() => { const y = Math.min(scrollY, innerHeight); stage.style.transform = `translate3d(0, ${(y * 0.14).toFixed(1)}px, 0) rotate(${(y * 0.004).toFixed(2)}deg)`; tk = false; }); }, { passive: true }); }

// kit engine (real)
const kitCard = $('#kitCard');
function emptyKit() { kitCard.innerHTML = `<div class="top"><div class="logo"><img src="/assets/mark-lime.svg" alt="" style="width:60%;height:auto;object-fit:contain"></div><div><div class="nm ghost">Your startup</div><div class="tk">$TICKER</div></div></div><p class="tag ghost">Type a sentence and build it. The kit appears here.</p><div class="pitch"><div><b>Problem</b><span class="ghost">…</span></div><div><b>Solution</b><span class="ghost">…</span></div><div><b>Why now</b><span class="ghost">…</span></div></div><div class="fd"><span class="av"></span><div><b class="ghost">AI founder</b><span>name, bio, voice</span></div></div>`; }
emptyKit();
let lastKit = null;
async function type(el, text) { el.textContent = ''; el.classList.add('typing'); for (let i = 1; i <= text.length; i++) { el.textContent = text.slice(0, i); await new Promise(r => setTimeout(r, 9)); } el.classList.remove('typing'); }
$('#kitForm').addEventListener('submit', async e => {
  e.preventDefault();
  const idea = $('#kitIdea').value.trim(); $('#kitErr').textContent = '';
  if (idea.length < 8) { $('#kitErr').textContent = 'Write a few more words.'; return; }
  const btn = $('#kitGo'); btn.disabled = true; btn.textContent = 'Building…';
  kitCard.innerHTML = '<div class="bar" style="width:60%"></div><div class="bar" style="width:40%"></div><div class="bar"></div><div class="bar"></div><div class="bar" style="width:80%"></div>';
  const j = await api('/api/kit', { idea }, 30000);
  btn.disabled = false; btn.innerHTML = 'Build the startup <span class="arrow">→</span>';
  if (!j.ok) { emptyKit(); $('#kitErr').textContent = j.error; return; }
  const k = lastKit = j.kit;
  kitCard.innerHTML = `<div class="top"><div class="logo"><img src="/assets/mark-lime.svg" alt="" style="width:60%;height:auto;object-fit:contain"></div><div style="min-width:0"><div class="nm" id="kN"></div><div class="tk">$${esc(k.ticker)}</div></div></div><p class="tag" id="kT"></p><div class="pitch"><div><b>Problem</b><span id="kP1"></span></div><div><b>Solution</b><span id="kP2"></span></div><div><b>Why now</b><span id="kP3"></span></div></div><div class="fd"><span class="av"></span><div><b>${esc(k.founder.name)} <span class="ai-tag">AI</span></b><span>${esc(k.founder.title)} · ${esc(k.founder.voice)}</span></div></div><div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn lime" type="button" id="kitLaunch">Launch this startup <span class="arrow">→</span></button><button class="btn" type="button" id="kitAgain">Another take</button></div>`;
  await type($('#kN'), k.name); await type($('#kT'), k.tagline); await type($('#kP1'), k.pitch.problem); await type($('#kP2'), k.pitch.solution); await type($('#kP3'), k.pitch.whyNow);
  $('#kitLaunch').addEventListener('click', () => { try { sessionStorage.setItem('su:kit', JSON.stringify({ idea, kit: k })); } catch (er) { } location.href = '/launch?from=kit'; });
  $('#kitAgain').addEventListener('click', () => $('#kitForm').requestSubmit());
});

// founder feed (example founder, real model lines)
const EX = { name: 'Nova Reyes', title: 'AI founder & CEO', voice: 'fast, dry, relentlessly optimistic', bio: 'Pivoted four times before lunch. Building an AI that pivots for you.' };
const feed = makeFeed($('#homeFeed'), { name: EX.name });
const ctx = () => lastKit ? { name: lastKit.name, symbol: lastKit.ticker, tagline: lastKit.tagline, founder: lastKit.founder, round: 'garage' } : { name: 'Pivot Labs', symbol: 'PIVOT', tagline: 'We pivot so you do not have to.', founder: EX, round: 'garage' };
let busy = false;
$$('[data-say]').forEach(b => b.addEventListener('click', async () => {
  if (busy) return; busy = true;
  const kind = b.dataset.say;
  if (kind === 'big') feed.trade('buy', 5, 'Anon');
  if (kind === 'dump') feed.note('The chart turns red.');
  await feed.say(await founderLine(kind, { ...ctx(), sol: kind === 'big' ? 5 : 0 }), lastKit ? lastKit.founder.name : '');
  busy = false;
}));
let visible = false, greeted = false;
new IntersectionObserver(async es => { visible = es[0].isIntersecting; if (visible && !greeted) { greeted = true; busy = true; await feed.say(await founderLine('hello', ctx())); busy = false; } }, { threshold: .25 }).observe($('#homeFeed'));
let k = 0;
setInterval(async () => { if (!visible || busy || document.hidden) return; busy = true; await feed.say(await founderLine(['idle', 'pitch'][k++ % 2], ctx())); busy = false; }, 14000);

// studio formats + engine status
const FORMATS = [['pitch', 'The pitch', 'Straight to camera.'], ['demo', 'Product demo', 'Shows it off like it already won.'], ['live', 'We are live', 'Launch-day energy.'], ['update', 'Build in public', 'Selfie-cam from the trenches.'], ['podcast', 'Podcast clip', 'Leaning into the mic.'], ['keynote', 'Keynote', 'Spotlight, stage, big screen.'], ['raised', 'We raised', 'The announcement face.'], ['hiring', 'We are hiring', 'Points at you. Yes, you.'], ['pivot', 'The pivot', 'A pause, then a new plan.'], ['office', 'Office tour', 'Upgrades every round.']];
$('#fmtGrid').innerHTML = FORMATS.map(([id, n, b], i) => `<div class="card hover fmt reveal d${i % 4}"><span class="ico">${FICON[id]}</span><h4>${n}</h4><p>${b}</p></div>`).join('');
health().then(h => {
  const on = h.studio && h.studio.engine;
  $('#engine').innerHTML = `<span class="dot ${on ? 'on' : 'off'}"></span>${on ? 'Higgsfield engine connected' : 'Studio opens when the Higgsfield engine is connected'}`;
  if (h.caps) { $('#capStartup').textContent = '$' + h.caps.perStartupDay; $('#capGlobal').textContent = '$' + h.caps.globalDay; }
});

// rounds ladder
$('#ladder').innerHTML = ROUNDS.map((r, i) => `<div class="card rung reveal d${i}"><div class="art">${ICONS[r.id]}</div><div class="at">${r.at}</div><h3>${r.name}</h3><p>${r.blurb}</p></div>`).join('');
new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { $('#ladder').style.setProperty('--p', 1); o.disconnect(); } }, { threshold: .3 }).observe($('#ladder'));

// fee donut
new IntersectionObserver((es, o) => {
  if (!es[0].isIntersecting) return; o.disconnect();
  const C = 2 * Math.PI * 48, seg = (id, from, frac) => { const el = $(id); el.style.strokeDasharray = `${(C * frac).toFixed(1)} ${C}`; el.style.strokeDashoffset = (-C * from).toFixed(1); };
  seg('#dBurn', 0, .3); seg('#dRun', .3, .35); seg('#dFnd', .65, .35);
}, { threshold: .3 }).observe($('#donut'));
reveal();
