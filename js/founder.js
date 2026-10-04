// AI founder lines: /api/say in the founder's voice, with house lines when the model is busy. Typed into a feed.
import { esc, api } from './util.js';
const HOUSE = {
  hello: ['welcome to the company. we ship daily.', 'you found us early. that matters.', 'pull up a chair. we are building in public.'],
  pitch: ['we make the hard part disappear. that is the whole pitch.', 'big market, broken workflow, one fix. we are the fix.'],
  buy: ['new believer just joined the cap table vibes. welcome.', 'another one in. back to shipping.', 'that buy goes straight into the momentum bank.'],
  big: ['ok that is a real check. adding it to the deck.', 'whale in the building. stay calm, keep shipping.'],
  sell: ['someone took profit. respect. we keep building.', 'churn happens. roadmap does not change.'],
  milestone: ['new round unlocked. moving offices.', 'milestone hit. the team is screaming in the slack.'],
  idle: ['heads down. shipping something good.', 'quiet day means deep work.', 'whiteboard is full again.'],
  pump: ['the chart is doing the marketing today.', 'green candles, same roadmap.'],
  dump: ['red day. founders build on red days.', 'volatility is just user research.'],
};
export function houseLine(kind) { const a = HOUSE[kind] || HOUSE.idle; return a[Math.floor(Math.random() * a.length)]; }
let last = 0;
export async function founderLine(kind, ctx) {
  if (Date.now() - last > 4000) {
    last = Date.now();
    const j = await api('/api/say', { kind, ctx }, 12000);
    if (j.ok && j.line) return j.line;
  }
  return houseLine(kind);
}
export function makeFeed(el, who) {
  const max = 40;
  const push = node => { el.append(node); while (el.children.length > max) el.firstChild.remove(); };
  return {
    async say(text, meta = '') {
      const m = document.createElement('div'); m.className = 'msg';
      const av = who.image ? `<span class="av" style="background-image:url('${esc(who.image)}')"></span>` : `<span class="av">AI</span>`;
      m.innerHTML = `${av}<div><div class="meta">${esc(who.name || 'AI founder')} · AI${meta ? ' · ' + esc(meta) : ''}</div><div class="bub typing"></div></div>`;
      push(m);
      const bub = m.querySelector('.bub'); const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) { bub.textContent = text; bub.classList.remove('typing'); return; }
      for (let i = 1; i <= text.length; i++) { bub.textContent = text.slice(0, i); await new Promise(r => setTimeout(r, 14)); }
      bub.classList.remove('typing');
    },
    trade(side, solAmt, trader) {
      const m = document.createElement('div'); m.className = 'msg trade';
      m.innerHTML = `<span class="av">${side === 'buy' ? '↑' : '↓'}</span><div class="bub"><span class="${side}">${side === 'buy' ? 'BUY' : 'SELL'}</span> ${solAmt.toFixed(solAmt < 1 ? 3 : 2)} SOL · ${esc(String(trader || '').slice(0, 4))}…</div>`;
      push(m);
    },
    note(text) { const m = document.createElement('div'); m.className = 'msg trade'; m.innerHTML = `<span class="av">·</span><div class="bub">${esc(text)}</div>`; push(m); },
  };
}
