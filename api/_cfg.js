// STARTUP config. Every value here is public. Wallet keys never live in this repo or on this server.
const env = k => (process.env[k] || '').trim();
const PLATFORM = env('PLATFORM_WALLET');
module.exports = {
  // read-only registry key: every STARTUP launch transaction carries it, so getSignaturesForAddress(REG) lists them
  REG: '7pv4khjr1kQwqibhE7tN4QtA2WdPQzkj56kHcG9bvATv',
  MEMO_PREFIX: 'su:v1:',
  // fee split, locked at launch through pump.fun fee sharing (basis points, sum 10000)
  SPLIT: { burn: 3000, runway: 3500, founder: 3500 },
  BURN_WALLET: env('BURN_WALLET') || PLATFORM,     // buys and burns $STARTUP
  RUNWAY_WALLET: env('RUNWAY_WALLET') || PLATFORM, // pays only for each startup's own Studio videos
  STARTUP_MINT: env('STARTUP_MINT'),               // the $STARTUP token, once it exists
  // funding rounds by market cap (USD); IPO = graduating off the pump.fun bonding curve
  ROUNDS: [
    { id: 'garage', name: 'Garage', at: 0 },
    { id: 'seed', name: 'Seed', at: 25000 },
    { id: 'ipo', name: 'IPO', at: null },
    { id: 'unicorn', name: 'Unicorn', at: 1000000 },
  ],
  // Studio policy (USD); enforced server-side against the ledger
  STUDIO: { perVideoMax: 2.5, perStartupDay: 10, globalDay: 60, needsApprovalAbove: 2.5 },
  X: env('X_URL'),                                  // https://x.com/<handle> once it exists
  launchOpen() { return !!(this.BURN_WALLET && this.RUNWAY_WALLET); },
};
