import crypto from 'node:crypto';
import { q } from './db.js';

const SECRET = process.env.JWT_SECRET || '';
if (!SECRET) console.warn('[auth] JWT_SECRET is not set — using a random one (everyone is logged out on restart).');
const KEY = SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_DAYS = 180;

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function checkPassword(pw, stored) {
  const [kind, s, h] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !s || !h) return false;
  const want = Buffer.from(h, 'base64');
  const got = crypto.scryptSync(pw, Buffer.from(s, 'base64'), want.length);
  return crypto.timingSafeEqual(want, got);
}

const b64u = (b) => Buffer.from(b).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', KEY).update(data).digest('base64url');

export function makeToken(user) {
  const body = b64u(JSON.stringify({ uid: user.id, role: user.role, exp: Date.now() + TOKEN_DAYS * 86400e3 }));
  return `${body}.${sign(body)}`;
}

function readToken(tok) {
  const [body, sig] = String(tok || '').split('.');
  if (!body || !sig) return null;
  const want = sign(body);
  if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

/** Express middleware: sets req.user = {id, email, name, role} or answers 401. */
export async function requireUser(req, res, next) {
  const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const p = readToken(tok);
  if (!p) return res.status(401).json({ error: 'Please log in again.' });
  try {
    const r = await q('UPDATE users SET last_seen = now() WHERE id = $1 RETURNING id, email, name, role, disabled', [p.uid]);
    const u = r[0];
    if (!u || u.disabled) return res.status(401).json({ error: 'This account is not active.' });
    req.user = u;
    next();
  } catch (e) { next(e); }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  next();
}

// Simple brute-force guard for login/register: 10 tries per 10 minutes per IP+email.
const tries = new Map();
export function tooMany(key) {
  const now = Date.now();
  const list = (tries.get(key) || []).filter((t) => now - t < 10 * 60e3);
  list.push(now);
  tries.set(key, list);
  if (tries.size > 5000) tries.clear();
  return list.length > 10;
}

/** Make sure the admin from the server settings exists and can log in. */
export async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const pw = process.env.ADMIN_PASSWORD || '';
  if (!email || !pw) { console.warn('[auth] ADMIN_EMAIL / ADMIN_PASSWORD not set — no admin login.'); return; }
  const r = await q('SELECT id, pass_hash, role FROM users WHERE email = $1', [email]);
  let id;
  if (!r[0]) {
    id = (await q("INSERT INTO users (email, name, pass_hash, role) VALUES ($1, 'Admin', $2, 'admin') RETURNING id", [email, hashPassword(pw)]))[0].id;
  } else {
    id = r[0].id;
    // the password in the server settings always works, so a forgotten admin password is fixed by changing it there
    if (r[0].role !== 'admin' || !checkPassword(pw, r[0].pass_hash)) await q("UPDATE users SET role = 'admin', pass_hash = $2, disabled = false WHERE id = $1", [id, hashPassword(pw)]);
  }
  // photos uploaded by the old single-user app belong to the owner (the admin)
  await q('UPDATE food_photos SET user_id = $1 WHERE user_id IS NULL', [id]);
}
