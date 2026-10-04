// STARTUP ledger (Neon Postgres via DATABASE_URL). Optional: without it, the Studio stays closed and says so.
let sql = null, ready = null;
function on() { return !!process.env.DATABASE_URL; }
function db() {
  if (!on()) return null;
  if (!sql) { const { neon } = require('@neondatabase/serverless'); sql = neon(process.env.DATABASE_URL); }
  return sql;
}
async function init() {
  const q = db(); if (!q) return null;
  if (!ready) ready = q`CREATE TABLE IF NOT EXISTS su_jobs (id text PRIMARY KEY, mint text NOT NULL, format text NOT NULL, wallet text NOT NULL, status text NOT NULL, cost_usd numeric NOT NULL DEFAULT 0, video text, error text, created timestamptz NOT NULL DEFAULT now(), updated timestamptz NOT NULL DEFAULT now())`
    .then(() => q`CREATE INDEX IF NOT EXISTS su_jobs_mint ON su_jobs (mint, created DESC)`).catch(e => { ready = null; throw e; });
  await ready;
  return q;
}
module.exports = { on, init };
