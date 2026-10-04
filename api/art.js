// POST /api/art {kind:'logo'|'founder', prompt, name?, seed?} : a logo (flat app icon) or a photoreal AI founder headshot.
const L = require('./_lib');
const A = require('./_ai');
module.exports = L.wrap(async (req, res) => {
  if (req.method !== 'POST') return L.send(res, 405, { ok: false, error: 'POST only' });
  if (A.limited('art:' + A.ip(req), 8, 600e3)) return L.send(res, 429, { ok: false, error: 'Too many images in a row. Wait a few minutes.' });
  const b = await L.body(req);
  const kind = b.kind === 'founder' ? 'founder' : 'logo';
  const brief = A.clean(b.prompt, 200), name = A.clean(b.name, 32);
  if (brief.length < 3) return L.send(res, 400, { ok: false, error: 'Describe it first.' });
  const seed = Math.max(0, Math.min(1e6, parseInt(b.seed, 10) || 0)) || undefined;
  const prompt = kind === 'logo'
    ? `Minimal flat vector app icon for a startup${name ? ' called ' + name : ''}: ${brief}. One bold simple symbol, centered, thick clean shapes, two or three flat colors on a plain solid background, high contrast, modern tech brand mark. No text, no letters, no words, no numbers, no watermark.`
    : `Photorealistic studio headshot of a fictional startup founder: ${brief}. Head and shoulders, facing the camera, confident relaxed expression, soft key light with a subtle rim light, plain dark charcoal backdrop, 85mm lens, shallow depth of field, natural skin texture, editorial magazine quality. Not a real person, no celebrity likeness. No text, no logos, no watermark.`;
  try {
    const img = await A.image(req, prompt, { seed, format: kind === 'logo' ? 'png' : 'jpeg', photoreal: kind === 'founder' });
    L.send(res, 200, { ok: true, image: 'data:' + img.mime + ';base64,' + img.buf.toString('base64'), engine: img.engine, model: img.model });
  } catch (e) {
    L.send(res, 503, { ok: false, error: 'The image engine is busy. Try again in a moment.' });
  }
});
