// STARTUP on-chain helpers: the fee-split transaction (pump.fun fee sharing, admin revoked), account decoders, payouts.
// Nothing here holds a key. Every transaction is returned unsigned and signed in the founder's own wallet.
const W = require('@solana/web3.js');
const { PUMP_SDK, OnlinePumpSdk, feeSharingConfigPda, bondingCurvePda, creatorVaultPda } = require('@pump-fun/pump-sdk');
const { NATIVE_MINT, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const L = require('./_lib');
const C = require('./_cfg');

const MEMO = new W.PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const PUMP = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const INITIAL_REAL_TOKENS = 793100000n * 1000000n; // pump.fun curve: tokens sold before graduation
const RENT_ZERO = 890880; // rent-exempt minimum of an empty system account (lamports)
const RPC_URL = process.env.RPC_URL || 'https://solana-rpc.publicnode.com';

// The split every STARTUP coin is launched with. Same address twice → one merged shareholder.
function shares(founder) {
  const rows = [
    { address: C.BURN_WALLET, bps: C.SPLIT.burn, role: 'burn' },
    { address: C.RUNWAY_WALLET, bps: C.SPLIT.runway, role: 'runway' },
    { address: founder, bps: C.SPLIT.founder, role: 'founder' },
  ];
  const out = [];
  for (const r of rows) {
    const hit = out.find(o => o.address === r.address);
    if (hit) { hit.bps += r.bps; hit.role += '+' + r.role; } else out.push({ ...r });
  }
  return out;
}

function memoIx(text) { return new W.TransactionInstruction({ programId: MEMO, keys: [], data: Buffer.from(text, 'utf8') }); }
function regIx(payer) {
  const t = W.SystemProgram.transfer({ fromPubkey: payer, toPubkey: payer, lamports: 0 });
  t.keys.push({ pubkey: new W.PublicKey(C.REG), isSigner: false, isWritable: false });
  return t;
}

// tx: create the coin's fee-sharing config, write the 30/35/35 split (this revokes the admin, so it can never change),
// and tag it for the STARTUP registry with a memo + the read-only REG key.
async function splitTx({ founder, mint, founderCid, blockhash }) {
  const f = new W.PublicKey(founder), m = new W.PublicKey(mint);
  const holders = shares(founder).map(s => ({ address: new W.PublicKey(s.address), shareBps: s.bps }));
  const ixs = [
    W.ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 }),
    W.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 150000 }),
    await PUMP_SDK.createFeeSharingConfig({ creator: f, mint: m, pool: null }),
    await PUMP_SDK.updateFeeSharesV2({ authority: f, mint: m, currentShareholders: [f], newShareholders: holders, quoteMint: NATIVE_MINT, quoteTokenProgram: TOKEN_PROGRAM_ID }),
    memoIx(C.MEMO_PREFIX + mint + ':' + (founderCid || '-')),
    regIx(f),
  ];
  const msg = new W.TransactionMessage({ payerKey: f, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message();
  const tx = new W.VersionedTransaction(msg);
  const bytes = tx.serialize();
  if (bytes.length > 1232) throw new Error('split transaction too large');
  return Buffer.from(bytes).toString('base64');
}

async function blockhash() { const r = await L.rpc('getLatestBlockhash', [{ commitment: 'confirmed' }]); return r.value.blockhash; }

// --- decoders (layouts from the pump / pump_fees IDLs) ---
function b58(buf) { return new W.PublicKey(buf).toBase58(); }
function decodeCurve(data) {
  const b = Buffer.from(data, 'base64');
  if (b.length < 81) return null;
  const realTok = b.readBigUInt64LE(24), realSol = b.readBigUInt64LE(32);
  const complete = b[48] === 1;
  const sold = INITIAL_REAL_TOKENS > realTok ? INITIAL_REAL_TOKENS - realTok : 0n;
  const progress = complete ? 1 : Math.max(0, Math.min(1, Number(sold * 10000n / INITIAL_REAL_TOKENS) / 10000));
  return { complete, progress, creator: b58(b.subarray(49, 81)), realSol: Number(realSol) };
}
function decodeSplit(data) {
  const b = Buffer.from(data, 'base64');
  if (b.length < 80) return null;
  const version = b[9], admin = b58(b.subarray(43, 75)), revoked = b[75] === 1, n = b.readUInt32LE(76);
  const rows = [];
  for (let i = 0; i < n && i < 10; i++) { const o = 80 + i * 34; if (o + 34 > b.length) break; rows.push({ address: b58(b.subarray(o, o + 32)), bps: b.readUInt16LE(o + 32) }); }
  const role = a => [a === C.BURN_WALLET && 'burn', a === C.RUNWAY_WALLET && 'runway'].filter(Boolean).join('+') || 'founder';
  return { version, admin, locked: version === 1 || (version === 2 && revoked), shares: rows.map(r => ({ ...r, role: role(r.address) })) };
}

// curve + split + vault for many mints in three batched reads
async function chainState(mints) {
  const out = {};
  if (!mints.length) return out;
  const list = mints.map(m => new W.PublicKey(m));
  const curves = list.map(m => bondingCurvePda(m).toBase58());
  const cfgs = list.map(m => feeSharingConfigPda(m));
  const vaults = cfgs.map(c => creatorVaultPda(c).toBase58());
  const read = async keys => { const all = []; for (let i = 0; i < keys.length; i += 100) { const r = await L.rpc('getMultipleAccounts', [keys.slice(i, i + 100), { encoding: 'base64', commitment: 'confirmed' }]); all.push(...(r.value || [])); } return all; };
  const [cv, sc, vv] = await Promise.all([read(curves), read(cfgs.map(c => c.toBase58())), read(vaults)]);
  mints.forEach((m, i) => {
    out[m] = {
      curve: cv[i] ? decodeCurve(cv[i].data[0]) : null,
      split: sc[i] ? decodeSplit(sc[i].data[0]) : null,
      vault: vv[i] ? Math.max(0, vv[i].lamports - RENT_ZERO) : 0,
      config: cfgs[i].toBase58(),
    };
  });
  return out;
}

// permissionless payout of a startup's creator fees to its shareholders (works before and after graduation)
async function payoutTx({ payer, mint }) {
  const conn = new W.Connection(RPC_URL, 'confirmed');
  const online = new OnlinePumpSdk(conn);
  const res = await online.buildDistributeCreatorFeesInstructions(new W.PublicKey(mint), { payer: new W.PublicKey(payer) });
  const ixs = Array.isArray(res) ? res : (res.instructions || []);
  if (!ixs.length) throw new Error('nothing to pay out yet');
  const msg = new W.TransactionMessage({ payerKey: new W.PublicKey(payer), recentBlockhash: await blockhash(), instructions: [W.ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }), ...ixs] }).compileToV0Message();
  return Buffer.from(new W.VersionedTransaction(msg).serialize()).toString('base64');
}

module.exports = { shares, splitTx, blockhash, chainState, decodeCurve, decodeSplit, payoutTx, feeSharingConfigPda, bondingCurvePda, PUMP };
