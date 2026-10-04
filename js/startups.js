import { $, $$, esc, nav, startups, cardHTML, reveal, ROUNDS } from './util.js';
nav();
const st = { sort: 'vol', q: '', round: 'all', list: null };
$('#roundChips').innerHTML = [['all', 'All rounds']].concat(ROUNDS.map(r => [r.id, r.name])).map(([id, n]) => `<button class="chip" type="button" data-r="${id}" aria-pressed="${id === 'all'}">${n}</button>`).join('');
$$('#roundChips .chip').forEach(c => c.addEventListener('click', () => { st.round = c.dataset.r; $$('#roundChips .chip').forEach(x => x.setAttribute('aria-pressed', x === c)); draw(); }));
$$('.seg [data-sort]').forEach(b => b.addEventListener('click', () => { st.sort = b.dataset.sort; $$('.seg [data-sort]').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); }));
$('#q').addEventListener('input', e => { st.q = e.target.value.trim().toLowerCase(); draw(); });
const key = { vol: s => (s.market && s.market.vol24) || 0, mcap: s => (s.market && s.market.mcap) || 0, new: s => s.t || 0 };
function draw() {
  const L = $('#list');
  if (st.list === null) { L.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>Registry busy</h3><p>Solana is slow to answer right now. Refresh in a moment.</p></div>'; return; }
  if (!st.list.length) { L.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>No startups yet</h3><p>Be the first founder. Demo Day fills itself from chain the moment you launch.</p><a class="btn lime" href="/launch">Launch a startup</a></div>'; return; }
  let a = st.list.filter(s => st.round === 'all' || s.round === st.round);
  if (st.q) a = a.filter(s => [s.name, s.symbol, s.founder && s.founder.name, s.tagline].join(' ').toLowerCase().includes(st.q));
  a.sort((x, y) => key[st.sort](y) - key[st.sort](x));
  L.innerHTML = a.length ? a.map((s, i) => cardHTML(s, i)).join('') : '<div class="empty-state" style="grid-column:1/-1"><h3>Nothing matches</h3><p>Try another search or round.</p></div>';
  reveal(L);
}
$('#list').innerHTML = '<div class="card" style="grid-column:1/-1"><div class="bar"></div><div class="bar" style="width:60%"></div></div>';
startups().then(l => { st.list = l; draw(); });
