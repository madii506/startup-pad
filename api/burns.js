// GET /api/burns : the $STARTUP burns made from the burn wallet, read from chain. Empty until both exist.
const L = require('./_lib');
const C = require('./_cfg');
module.exports = L.wrap(async (req, res) => {
  const out = { ok: true, wallet: C.BURN_WALLET || null, token: C.STARTUP_MINT || null, sol: null, burns: [] };
  if (!C.BURN_WALLET) return L.send(res, 200, out, 'public, s-maxage=60');
  const data = await L.cached('burns', 60e3, async () => {
    const r = { sol: null, burns: [] };
    try { r.sol = (await L.rpc('getBalance', [C.BURN_WALLET, { commitment: 'confirmed' }])).value; } catch (e) { }
    if (!C.STARTUP_MINT) return r;
    const sigs = (await L.rpc('getSignaturesForAddress', [C.BURN_WALLET, { limit: 60, commitment: 'confirmed' }])) || [];
    for (const s of sigs.filter(x => !x.err).slice(0, 40)) {
      let tx; try { tx = await L.rpc('getTransaction', [s.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]); } catch (e) { continue; }
      const ixs = [...((tx && tx.transaction.message.instructions) || []), ...((tx && tx.meta && tx.meta.innerInstructions) || []).flatMap(x => x.instructions)];
      for (const ix of ixs) {
        const p = ix.parsed; if (!p || !/^burn/.test(p.type || '') || !p.info || p.info.mint !== C.STARTUP_MINT) continue;
        const amt = p.info.tokenAmount ? Number(p.info.tokenAmount.uiAmount) : Number(p.info.amount) / 1e6;
        r.burns.push({ sig: s.signature, t: (s.blockTime || 0) * 1000, amount: amt });
      }
    }
    return r;
  });
  L.send(res, 200, { ...out, ...data }, 'public, s-maxage=60');
});
