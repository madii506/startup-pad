import { $, $$, esc, api, health, nav, toast, short, shareX } from './util.js';
import { walletsAvailable, connectWallet } from './wallet.js';
nav();
const S = { idea: '', kit: null, logo: null, face: null, step: 1, w: null, buy: 0 };
const IDEAS = ['A dating app for co-founders', 'An AI that answers your emails as you', 'Netflix for 30-second courses', 'A gym that pays you to show up', 'Google Maps for good vibes'];
$('#chips').innerHTML = IDEAS.map(i => `<button class="chip" type="button">${esc(i)}</button>`).join('');
$$('#chips .chip').forEach(c => c.addEventListener('click', () => { $('#idea').value = c.textContent; $('#idea').focus(); }));

// ---------- steps ----------
function go(n) {
  S.step = n;
  $$('.panel').forEach(p => p.classList.toggle('on', +p.dataset.step === n));
  $$('#stepnav button').forEach(b => { const k = +b.dataset.go; b.toggleAttribute('aria-current', k === n); if (k === n) b.setAttribute('aria-current', 'step'); b.classList.toggle('done', k < n); b.disabled = k > maxStep(); });
  window.scrollTo({ top: Math.max(0, $('#stepnav').offsetTop - 80), behavior: 'smooth' });
  if (n === 4) step4();
}
const maxStep = () => !S.kit ? 1 : (!S.logo || !S.face) ? 3 : 4;
$$('#stepnav button').forEach(b => b.addEventListener('click', () => { if (!b.disabled) go(+b.dataset.go); }));

// ---------- step 1: idea → kit ----------
const F = { fName: 'name', fTick: 'ticker', fTag: 'tagline', fProb: 'pitch.problem', fSol: 'pitch.solution', fWhy: 'pitch.whyNow', fFn: 'founder.name', fFt: 'founder.title', fBio: 'founder.bio', fVoice: 'founder.voice', fLook: 'founder.look' };
const getP = (o, p) => p.split('.').reduce((a, k) => a && a[k], o);
const setP = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => (a[k] = a[k] || {}), o)[last] = v; };
function fill() { for (const [id, p] of Object.entries(F)) $('#' + id).value = getP(S.kit, p) || ''; $('#fLogo').value = (S.kit.logo && S.kit.logo.prompt) || ''; counts(); preview(); }
async function build(idea) {
  $('#e1').textContent = ''; const b = $('#b1'); b.disabled = true; b.textContent = 'Building your startup…';
  const j = await api('/api/kit', { idea }, 35000);
  b.disabled = false; b.innerHTML = 'Build my startup <span class="arrow">→</span>';
  if (!j.ok) { $('#e1').textContent = j.error; $('#e2').textContent = j.error; return false; }
  S.idea = idea; S.kit = j.kit; S.logo = null; S.face = null; resetFrames(); fill(); return true;
}
$('#ideaForm').addEventListener('submit', async e => { e.preventDefault(); const v = $('#idea').value.trim(); if (v.length < 8) { $('#e1').textContent = 'Write a few more words.'; return; } if (await build(v)) go(2); });

// ---------- step 2: edit ----------
function counts() { $('#cName').textContent = $('#fName').value.length + '/32'; $('#cTag').textContent = $('#fTag').value.length + '/80'; $('#cBio').textContent = $('#fBio').value.length + '/160'; }
for (const [id, p] of Object.entries(F)) $('#' + id).addEventListener('input', e => { let v = e.target.value; if (id === 'fTick') { v = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10); e.target.value = v; } setP(S.kit, p, v); counts(); preview(); });
$('#fName').addEventListener('change', () => { if (!$('#fTick').value) { $('#fTick').value = $('#fName').value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10); S.kit.ticker = $('#fTick').value; preview(); } });
$('#fLogo').addEventListener('input', e => { S.kit.logo = { prompt: e.target.value }; });
$('#regen').addEventListener('click', async () => { if (S.idea && await build(S.idea)) toast('Rebuilt'); });
$('#b2').addEventListener('click', () => {
  const k = S.kit; $('#e2').textContent = '';
  if (!k.name || k.name.length < 2) return void ($('#e2').textContent = 'Give the startup a name.');
  if (!k.ticker || k.ticker.length < 2) return void ($('#e2').textContent = 'The ticker needs 2–10 letters or numbers.');
  if (!k.founder || !k.founder.name) return void ($('#e2').textContent = 'Name your AI founder.');
  go(3);
});
const x = $('#fX'); x.addEventListener('input', () => { S.twitter = x.value.trim(); });

// ---------- step 3: visuals ----------
function resetFrames() { $('#logoFrame').style.backgroundImage = ''; $('#logoFrame').textContent = 'No logo yet'; $('#faceFrame').style.backgroundImage = ''; $('#faceFrame').textContent = 'No founder yet'; }
function shrink(src, size, type) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); const s = Math.min(im.width, im.height); g.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, size, size); res(c.toDataURL(type, .9)); }; im.onerror = () => rej(new Error('That image could not be read.')); im.src = src; });
}
function setFrame(which, url) { const f = $(which === 'logo' ? '#logoFrame' : '#faceFrame'); f.textContent = ''; f.style.backgroundImage = `url('${url}')`; }
async function gen(kind) {
  $('#e3').textContent = '';
  const btn = $(kind === 'logo' ? '#genLogo' : '#genFace'), frame = $(kind === 'logo' ? '#logoFrame' : '#faceFrame');
  const prompt = kind === 'logo' ? ($('#fLogo').value.trim() || (S.kit.logo && S.kit.logo.prompt) || S.kit.name) : (S.kit.founder.look || 'a confident founder in a black hoodie');
  btn.disabled = true; btn.textContent = 'Generating…'; frame.classList.add('busy');
  const j = await api('/api/art', { kind: kind === 'logo' ? 'logo' : 'founder', prompt, name: S.kit.name, seed: Math.floor(Math.random() * 1e6) }, 65000);
  btn.disabled = false; btn.textContent = 'Regenerate'; frame.classList.remove('busy');
  if (!j.ok) { $('#e3').textContent = j.error; return; }
  const small = await shrink(j.image, 512, kind === 'logo' ? 'image/png' : 'image/jpeg');
  S[kind === 'logo' ? 'logo' : 'face'] = small; setFrame(kind, small); preview(); nav4();
}
$('#genLogo').addEventListener('click', () => gen('logo'));
$('#genFace').addEventListener('click', () => gen('face'));
for (const [inp, kind] of [['#upLogo', 'logo'], ['#upFace', 'face']]) $(inp).addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  if (f.size > 8e6) { $('#e3').textContent = 'That file is over 8 MB.'; return; }
  const r = new FileReader(); r.onload = async () => { try { const small = await shrink(r.result, 512, kind === 'logo' ? 'image/png' : 'image/jpeg'); S[kind] = small; setFrame(kind, small); preview(); nav4(); } catch (er) { $('#e3').textContent = er.message; } }; r.readAsDataURL(f);
});
function nav4() { $$('#stepnav button').forEach(b => { b.disabled = +b.dataset.go > maxStep(); }); }
$('#b3').addEventListener('click', () => { if (!S.logo) return void ($('#e3').textContent = 'Add a logo first.'); if (!S.face) return void ($('#e3').textContent = 'Add the founder headshot first.'); go(4); });

// ---------- preview ----------
function preview() {
  const k = S.kit || {};
  $('#pvName').textContent = k.name || 'Your startup';
  $('#pvTick').textContent = '$' + (k.ticker || 'TICKER') + ' · Garage';
  $('#pvTag').textContent = k.tagline || 'Your tagline shows up here.';
  $('#pvFn').textContent = (k.founder && k.founder.name) || 'Your AI founder';
  $('#pvFt').textContent = ((k.founder && k.founder.title) || 'AI founder & CEO') + ' · AI';
  if (S.logo) $('#pvLogo').src = S.logo;
  if (S.face) $('#pvFace').style.backgroundImage = `url('${S.face}')`;
}

// ---------- step 4: launch ----------
let H = null;
async function step4() {
  H = H || await health();
  const ws = walletsAvailable();
  $('#wallets').innerHTML = ws.length ? ws.map(id => `<button class="btn" type="button" data-w="${id}">${id[0].toUpperCase() + id.slice(1)}</button>`).join('') : '<span class="muted">Install Phantom, Solflare or Backpack to launch.</span>';
  $$('#wallets [data-w]').forEach(b => b.addEventListener('click', async () => {
    try { S.w = await connectWallet(b.dataset.w); $$('#wallets [data-w]').forEach(x => x.classList.toggle('lime', x === b)); b.textContent = S.w.name + ' · ' + short(S.w.address); splitMini(); arm(); }
    catch (e) { toast(e.message === 'cancelled' ? 'You cancelled the connection.' : 'Could not connect that wallet.'); }
  }));
  const opts = [0, 0.1, 0.25, 0.5, 1];
  $('#buys').innerHTML = opts.map(v => `<button class="chip" type="button" data-b="${v}" aria-pressed="${v === S.buy}">${v ? v + ' SOL' : 'None'}</button>`).join('') + `<input class="chip" id="fBuy" type="number" min="0" max="5" step="0.01" inputmode="decimal" aria-label="Custom dev buy in SOL" placeholder="custom">`;
  $$('#buys [data-b]').forEach(b => b.addEventListener('click', () => { S.buy = +b.dataset.b; $('#fBuy').value = ''; $$('#buys [data-b]').forEach(x => x.setAttribute('aria-pressed', x === b)); arm(); }));
  $('#fBuy').addEventListener('input', e => { S.buy = Math.max(0, Math.min(5, +e.target.value || 0)); $$('#buys [data-b]').forEach(x => x.setAttribute('aria-pressed', 'false')); arm(); });
  splitMini(); arm();
}
function splitMini() {
  const w = (H && H.wallets) || {};
  $('#splitMini').innerHTML = `<div><span>Burn rate · buys &amp; burns $STARTUP</span><b>30% · ${w.burn ? short(w.burn) : 'opens soon'}</b></div><div><span>Runway · pays for your Studio videos</span><b>35% · ${w.runway ? short(w.runway) : 'opens soon'}</b></div><div><span>You · the founder wallet</span><b>35% · ${S.w ? short(S.w.address) : 'your wallet'}</b></div><div style="border-style:dashed"><span>Locked in the launch. Nobody can change it later.</span><b class="lime">locked</b></div>`;
}
function arm() {
  const b = $('#go'), open = H && H.launch && H.launch.open;
  if (!open) { b.disabled = true; b.textContent = 'Launches open soon'; return; }
  b.disabled = !S.w || !S.kit || !S.logo || !S.face;
  b.textContent = S.w ? `Launch $${S.kit.ticker}${S.buy ? ' + ' + S.buy + ' SOL buy' : ''}` : 'Connect a wallet to launch';
}
$('#go').addEventListener('click', async () => {
  const b = $('#go'); if (b.disabled) return;
  b.disabled = true; const log = $('#log'); log.hidden = false; log.innerHTML = ''; $('#born').hidden = true;
  const rows = {};
  const onStep = (i, total, text, state) => { let li = rows[i]; if (!li) { li = rows[i] = document.createElement('li'); log.append(li); } li.className = state; li.innerHTML = `<span>${i}/${total} · ${text}</span>`; };
  try {
    const { launchStartup } = await import('./launchtx.js');
    const r = await launchStartup({ provider: S.w.provider, address: S.w.address, kit: S.kit, image: S.logo, founderImage: S.face, devBuySol: S.buy, twitter: /^https:\/\/(x|twitter)\.com\//.test(S.twitter || '') ? S.twitter : '', onStep });
    const url = location.origin + '/s/' + r.mint;
    $('#born').innerHTML = `<h3>${esc(S.kit.name)} is live.</h3><p class="muted" style="margin:0">$${esc(S.kit.ticker)} is on pump.fun, the fee split is locked, and ${esc(S.kit.founder.name)} just opened the doors.</p><div class="row"><a class="btn lime" href="/s/${esc(r.mint)}">Open the startup page</a><a class="btn" href="https://pump.fun/coin/${esc(r.mint)}" target="_blank" rel="noopener">pump.fun</a><a class="btn" href="${shareX(`I just launched ${S.kit.name} ($${S.kit.ticker}), an AI startup with its own token, on STARTUP.`, url)}" target="_blank" rel="noopener">Post it on X</a></div>`;
    $('#born').hidden = false;
  } catch (e) { b.disabled = false; arm(); }
});

// ---------- entry ----------
(async () => {
  const q = new URLSearchParams(location.search);
  let saved = null; try { saved = JSON.parse(sessionStorage.getItem('su:kit') || 'null'); } catch (e) { }
  if (q.get('from') === 'kit' && saved && saved.kit) { S.idea = saved.idea; S.kit = saved.kit; $('#idea').value = saved.idea || ''; fill(); go(2); return; }
  const idea = (q.get('idea') || '').slice(0, 200);
  if (idea) { $('#idea').value = idea; if (await build(idea)) go(2); }
  health().then(h => { H = h; });
})();
