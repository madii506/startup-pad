// GET /api/health : what is switched on for this deployment (no secrets, only yes/no and public addresses).
const L = require('./_lib');
const C = require('./_cfg');
const A = require('./_ai');
module.exports = L.wrap(async (req, res) => {
  L.send(res, 200, {
    ok: true,
    launch: { open: C.launchOpen() },
    ai: !!A.token(req),
    art: { engine: A.HF.on() ? 'higgsfield' : 'flux' },
    studio: { engine: A.HF.on() ? 'higgsfield' : null, ledger: !!process.env.DATABASE_URL },
    wallets: { burn: C.BURN_WALLET || null, runway: C.RUNWAY_WALLET || null },
    split: C.SPLIT, rounds: C.ROUNDS, caps: C.STUDIO,
    reg: C.REG, startupMint: C.STARTUP_MINT || null, x: C.X || null,
  }, 'public, s-maxage=30');
});
