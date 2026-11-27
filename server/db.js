// Neon Postgres over HTTPS (works on any host, no Postgres port needed).
import { neon } from '@neondatabase/serverless';

const URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '';
if (!URL) console.warn('[db] DATABASE_URL is not set — the API will not work until it is.');

// DATABASE_URL=pglite:memory runs a throwaway in-memory Postgres for local testing only.
let local = null;
if (URL.startsWith('pglite:')) {
  const { PGlite } = await import('@electric-sql/pglite');
  local = new PGlite();
}
const sqlFn = URL && !local ? neon(URL) : null;

export async function q(text, params = []) {
  if (local) return (await local.query(text, params)).rows;
  if (!sqlFn) throw Object.assign(new Error('Database not configured'), { status: 503 });
  return sqlFn.query(text, params);
}

export async function migrate() {
  if (!sqlFn && !local) return;
  await q(`CREATE TABLE IF NOT EXISTS users (
    id serial PRIMARY KEY,
    email text UNIQUE NOT NULL,
    name text NOT NULL DEFAULT '',
    pass_hash text NOT NULL,
    role text NOT NULL DEFAULT 'user',
    disabled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen timestamptz)`);
  await q(`CREATE TABLE IF NOT EXISTS user_state (
    user_id int PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    state jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now())`);
  // existing table from the single-user app; photos now belong to a user
  await q(`CREATE TABLE IF NOT EXISTS food_photos (
    id text PRIMARY KEY, day text NOT NULL, slot text, taken_at timestamptz, status text,
    name text, kcal int, image text, created_at timestamptz DEFAULT now())`);
  await q('ALTER TABLE food_photos ADD COLUMN IF NOT EXISTS thumb text');
  await q('ALTER TABLE food_photos ADD COLUMN IF NOT EXISTS user_id int REFERENCES users(id) ON DELETE CASCADE');
  await q('CREATE INDEX IF NOT EXISTS food_photos_user_day ON food_photos(user_id, day)');
  await q(`CREATE TABLE IF NOT EXISTS scan_log (
    user_id int REFERENCES users(id) ON DELETE CASCADE, at timestamptz NOT NULL DEFAULT now(), ok boolean)`);
  await q('CREATE INDEX IF NOT EXISTS scan_log_user_at ON scan_log(user_id, at)');
}
