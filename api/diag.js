// GET /api/diag : which server modules load on this deployment (no secrets). Temporary.
const out = {};
for (const m of ['@solana/web3.js', '@solana/spl-token', 'bn.js', '@pump-fun/pump-sdk', 'tweetnacl', 'bs58', '@neondatabase/serverless', './_chain', './_registry']) {
  try { require(m); out[m] = 'ok'; } catch (e) { out[m] = String(e && e.message || e).slice(0, 300); }
}
module.exports = (req, res) => { res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify({ node: process.version, out })); };
