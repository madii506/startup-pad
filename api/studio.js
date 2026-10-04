// /api/studio : the founder films videos for their startup with Higgsfield (image-to-video from the founder headshot).
//   GET  ?formats=1          the formats
//   GET  ?mint=<mint>        finished videos for a startup
//   GET  ?id=<job>           one job (polls Higgsfield while it runs)
//   POST {mint, format, wallet, ts, signature}   order a video; only the startup's founder wallet, within the caps
const L = require('./_lib');
const C = require('./_cfg');
const A = require('./_ai');
const D = require('./_db');

const COST = 0.4; // USD estimate per 5-second 720p clip (Kling 3.0 Turbo on Higgsfield)
const MODEL_PATH = '/kling-video/v3.0-turbo/image-to-video';
const SET = { garage: 'a cluttered suburban garage startup office at night with warm work lights', seed: 'a sunny coworking loft with plants and whiteboards', ipo: 'a sleek glass-walled headquarters high above a city', unicorn: 'a rooftop helipad office at golden hour above the skyline' };
const FORMATS = [
  { id: 'pitch', name: 'The pitch', blurb: 'Straight to camera. Ten seconds to make you care.', p: 'The founder looks straight into the camera and pitches with conviction, natural hand gestures, a slow cinematic push-in, shallow depth of field.' },
  { id: 'demo', name: 'Product demo', blurb: 'Shows the product off like it already won.', p: 'The founder lifts a glowing phone and turns the screen toward the camera with a proud smile, the camera slowly orbits, product-launch lighting.' },
  { id: 'live', name: 'We are live', blurb: 'Launch-day energy.', p: 'Confetti starts falling, the founder laughs and throws a fist in the air in celebration, handheld camera energy, launch-day vibe.' },
  { id: 'update', name: 'Build in public', blurb: 'A selfie-cam update from the trenches.', p: 'Vlog-style selfie camera: the founder talks casually while walking, small nods and smiles, natural handheld movement.' },
  { id: 'podcast', name: 'Podcast clip', blurb: 'Leaning into the mic with a hot take.', p: 'The founder leans toward a studio podcast microphone and speaks animatedly, warm podcast studio lighting, subtle camera drift.' },
  { id: 'keynote', name: 'Keynote', blurb: 'Spotlight, stage, big screen.', p: 'A stage spotlight hits the founder who presents to an unseen crowd, a big screen glows behind, the camera pushes in slowly.' },
  { id: 'raised', name: 'We raised', blurb: 'The announcement face.', p: 'The founder raises a coffee cup in a toast, gold confetti and celebratory lights, a slow-motion triumphant moment.' },
  { id: 'hiring', name: 'We are hiring', blurb: 'Points at you. Yes, you.', p: 'The founder points directly at the camera like a recruitment poster, then waves the viewer in with a grin, warm office light.' },
  { id: 'pivot', name: 'The pivot', blurb: 'A pause, a thought, a brand-new plan.', p: 'The founder pauses, eyes narrow in thought, then turns sharply with a sudden new idea, a dramatic dolly-zoom camera move.' },
  { id: 'office', name: 'Office tour', blurb: 'The office gets better every round.', p: 'The founder turns and gestures for the camera to follow, a tracking shot moving into the office.' },
];
const ID = /^[A-Za-z0-9-]{8,80}$/;
const pub = f => ({ id: f.id, name: f.name, blurb: f.blurb });

function verify(wallet, message, sig) {
  try {
    const nacl = require('tweetnacl'); const bs58 = require('bs58');
    const dec = (bs58.default || bs58).decode;
    return nacl.sign.detached.verify(new TextEncoder().encode(message), dec(sig), dec(wallet));
  } catch (e) { return false; }
}
async function refresh(q, row) {
  if (!row || /^(done|failed)$/.test(row.status) || !A.HF.on()) return row;
  try {
    const st = await A.HF.status(row.id);
    let status = row.status, video = row.video, error = row.error;
    if (st.status === 'completed' && st.video) { status = 'done'; video = st.video; }
    else if (/failed|nsfw|cancel/.test(st.status || '')) { status = 'failed'; error = st.status === 'nsfw' ? 'The video was blocked by the safety filter.' : 'The video engine could not make this one.'; }
    else if (st.status === 'in_progress') status = 'running';
    if (status !== row.status) { await q`UPDATE su_jobs SET status = ${status}, video = ${video}, error = ${error}, updated = now() WHERE id = ${row.id}`; return { ...row, status, video, error }; }
  } catch (e) { }
  return row;
}
const out = r => ({ id: r.id, mint: r.mint, format: r.format, status: r.status, video: r.video || null, error: r.error || null, t: new Date(r.created).getTime() });

module.exports = L.wrap(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'GET') {
    if (u.searchParams.get('formats')) return L.send(res, 200, { ok: true, formats: FORMATS.map(pub), engine: A.HF.on() ? 'higgsfield' : null, ledger: D.on(), caps: C.STUDIO }, 'public, s-maxage=300');
    if (!D.on()) return L.send(res, 200, { ok: true, videos: [], ledger: false });
    const q = await D.init();
    const id = u.searchParams.get('id'), mint = u.searchParams.get('mint');
    if (id) {
      if (!ID.test(id)) return L.send(res, 400, { ok: false, error: 'Unknown job.' });
      const rows = await q`SELECT * FROM su_jobs WHERE id = ${id}`;
      if (!rows.length) return L.send(res, 404, { ok: false, error: 'Unknown job.' });
      return L.send(res, 200, { ok: true, job: out(await refresh(q, rows[0])) });
    }
    if (mint && L.B58.test(mint)) {
      const rows = await q`SELECT * FROM su_jobs WHERE mint = ${mint} ORDER BY created DESC LIMIT 40`;
      const fresh = await Promise.all(rows.map(r => (Date.now() - new Date(r.created).getTime() < 3600e3 ? refresh(q, r) : r)));
      return L.send(res, 200, { ok: true, videos: fresh.filter(r => r.status === 'done').map(out), pending: fresh.filter(r => !/done|failed/.test(r.status)).length });
    }
    return L.send(res, 400, { ok: false, error: 'Pick a startup.' });
  }
  if (req.method !== 'POST') return L.send(res, 405, { ok: false, error: 'GET or POST' });
  if (!A.HF.on()) return L.send(res, 503, { ok: false, error: 'The Studio opens when its Higgsfield engine is connected.' });
  if (!D.on()) return L.send(res, 503, { ok: false, error: 'The Studio opens when its ledger is connected.' });
  if (A.limited('studio:' + A.ip(req), 6, 600e3)) return L.send(res, 429, { ok: false, error: 'Too many orders in a row. Wait a few minutes.' });
  const b = await L.body(req);
  const f = FORMATS.find(x => x.id === b.format);
  const mint = String(b.mint || ''), wallet = String(b.wallet || ''), ts = parseInt(b.ts, 10);
  if (!f) return L.send(res, 400, { ok: false, error: 'Pick a format.' });
  if (!L.B58.test(mint) || !L.B58.test(wallet)) return L.send(res, 400, { ok: false, error: 'Connect your founder wallet.' });
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) return L.send(res, 400, { ok: false, error: 'That signature expired. Sign again.' });
  const message = `STARTUP studio\nmint: ${mint}\nformat: ${f.id}\nts: ${ts}`;
  if (!verify(wallet, message, String(b.signature || ''))) return L.send(res, 401, { ok: false, error: 'The signature did not match this wallet.' });
  const card = await require('./_registry').card(mint);
  if (!card) return L.send(res, 404, { ok: false, error: 'This coin was not launched on STARTUP.' });
  if (card.creator !== wallet) return L.send(res, 403, { ok: false, error: 'Only this startup\'s founder wallet can order videos.' });
  if (!card.founder || !card.founder.image) return L.send(res, 409, { ok: false, error: 'This startup has no founder headshot to film.' });
  const q = await D.init();
  const [day] = await q`SELECT COALESCE(SUM(cost_usd), 0)::float AS s FROM su_jobs WHERE mint = ${mint} AND status <> 'failed' AND created > now() - interval '1 day'`;
  const [all] = await q`SELECT COALESCE(SUM(cost_usd), 0)::float AS s FROM su_jobs WHERE status <> 'failed' AND created > now() - interval '1 day'`;
  if (day.s + COST > C.STUDIO.perStartupDay) return L.send(res, 429, { ok: false, error: 'This startup hit today\'s Studio budget. Come back tomorrow.' });
  if (all.s + COST > C.STUDIO.globalDay) return L.send(res, 429, { ok: false, error: 'The Studio hit today\'s total budget. Come back tomorrow.' });
  const scene = f.id === 'office' ? ` The office is ${SET[card.round] || SET.garage}.` : '';
  const prompt = `${f.p}${scene} The person is ${card.founder.name || 'the founder'}, an AI startup founder. Photorealistic, cinematic, natural motion, no text, no logos.`;
  let job;
  try { job = await A.HF.submit(MODEL_PATH, { prompt, image_url: card.founder.image, duration: 5, resolution: '720p' }); }
  catch (e) { return L.send(res, 502, { ok: false, error: 'The video engine refused this one. Try another format.' }); }
  await q`INSERT INTO su_jobs (id, mint, format, wallet, status, cost_usd) VALUES (${job.request_id}, ${mint}, ${f.id}, ${wallet}, 'queued', ${COST})`;
  L.send(res, 200, { ok: true, job: { id: job.request_id, status: 'queued', format: f.id } });
});
module.exports.FORMATS = FORMATS;
