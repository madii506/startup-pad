// STARTUP AI helpers: Vercel AI Gateway over OIDC (chat + images) and the Higgsfield API (when its key is set).
const L = require('./_lib');
const CHAT = ['openai/gpt-4.1-mini', 'google/gemini-2.5-flash', 'openai/gpt-4o-mini'];
const IMAGE = ['bfl/flux-2-pro', 'bfl/flux-pro-1.1', 'bytedance/seedream-4.5'];
const GW = 'https://ai-gateway.vercel.sh/v1';

function token(req) { return (req && req.headers && req.headers['x-vercel-oidc-token']) || process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY || ''; }
function ip(req) { return String((req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim() || 'x'; }
const buckets = new Map(); // best-effort limiter per serverless instance
function limited(key, max, ms) {
  const now = Date.now(); const h = (buckets.get(key) || []).filter(t => now - t < ms); h.push(now); buckets.set(key, h);
  if (buckets.size > 8000) buckets.clear();
  return h.length > max;
}
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>`]/g, ' ').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

async function chat(req, messages, { max_tokens = 500, temperature = 0.9, json = false } = {}) {
  const tk = token(req); if (!tk) throw new Error('no ai');
  let last;
  for (const model of CHAT) {
    try {
      const body = { model, messages, temperature, max_tokens };
      if (json) body.response_format = { type: 'json_object' };
      const r = await L.get(GW + '/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: JSON.stringify(body) }, 20000);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j.error && (j.error.message || j.error.type)) || ('gateway ' + r.status));
      const text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!text) throw new Error('empty');
      return { text: String(text), model };
    } catch (e) { last = e; }
  }
  throw last || new Error('no model answered');
}
function parseJson(text) {
  const s = String(text || '').replace(/```(?:json)?/g, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no json');
  return JSON.parse(s.slice(a, b + 1));
}

// --- Higgsfield (https://docs.higgsfield.ai): Authorization: Key <id>:<secret>; submit → request_id; poll /requests/<id>/status
const HF_BASE = 'https://api.higgsfield.ai';
function hfKey() {
  const both = process.env.HF_CREDENTIALS || process.env.HIGGSFIELD_KEY || '';
  if (both.includes(':')) return both.trim();
  const id = process.env.HF_API_KEY_ID || process.env.HF_API_KEY || '', secret = process.env.HF_API_KEY_SECRET || process.env.HF_API_SECRET || '';
  return id && secret ? id.trim() + ':' + secret.trim() : '';
}
const HF = {
  on() { return !!hfKey(); },
  async submit(path, input) {
    const r = await L.get(HF_BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Key ' + hfKey() }, body: JSON.stringify(input) }, 20000);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.request_id) throw new Error('higgsfield ' + r.status + ' ' + JSON.stringify(j).slice(0, 160));
    return j;
  },
  async status(id) {
    const r = await L.get(HF_BASE + '/requests/' + encodeURIComponent(id) + '/status', { headers: { authorization: 'Key ' + hfKey() } }, 15000);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('higgsfield status ' + r.status);
    return { status: j.status, video: j.video && j.video.url || null, image: j.images && j.images[0] && j.images[0].url || null, raw: j };
  },
  async soul(prompt) { // photoreal image, polled up to ~45 s
    const s = await HF.submit('/higgsfield-ai/soul/v2/standard', { prompt, aspect_ratio: '1:1' });
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1500));
      const st = await HF.status(s.request_id);
      if (st.status === 'completed' && st.image) return st.image;
      if (/failed|nsfw|cancel/.test(st.status || '')) throw new Error('higgsfield ' + st.status);
    }
    throw new Error('higgsfield timeout');
  },
};

// image → { buf, mime, model, engine }. Higgsfield Soul for photoreal founders when keyed, else FLUX via AI Gateway.
async function image(req, prompt, { size = '1024x1024', seed, format = 'png', photoreal = false } = {}) {
  if (photoreal && HF.on()) {
    try {
      const url = await HF.soul(prompt);
      const r = await L.get(url, {}, 20000);
      if (r.ok) return { buf: Buffer.from(await r.arrayBuffer()), mime: r.headers.get('content-type') || 'image/jpeg', model: 'higgsfield/soul-v2', engine: 'higgsfield' };
    } catch (e) { /* fall through to FLUX */ }
  }
  const tk = token(req); if (!tk) throw new Error('no ai');
  let last;
  for (const model of IMAGE) {
    try {
      const body = { model, prompt, n: 1, size, providerOptions: { blackForestLabs: { outputFormat: format } } };
      if (seed) { body.seed = seed; body.providerOptions.blackForestLabs.seed = seed; }
      const r = await L.get(GW + '/images/generations', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tk }, body: JSON.stringify(body) }, 55000);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(model + ' ' + r.status);
      const b64 = j.data && j.data[0] && j.data[0].b64_json;
      if (!b64) throw new Error(model + ' no image');
      const buf = Buffer.from(b64, 'base64');
      return { buf, mime: buf[0] === 0x89 ? 'image/png' : 'image/jpeg', model, engine: 'flux' };
    } catch (e) { last = e; }
  }
  throw last || new Error('no image model answered');
}
module.exports = { chat, parseJson, image, HF, token, ip, limited, clean };
