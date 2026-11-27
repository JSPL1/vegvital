// VegVital server: serves the web app + admin page and the API the Android app talks to.
// Settings (Hostinger → Environment variables):
//   DATABASE_URL     Neon connection string
//   JWT_SECRET       long random text, keeps people logged in
//   ADMIN_EMAIL / ADMIN_PASSWORD   the admin login
//   GEMINI_API_KEY, GROQ_API_KEY, ANTHROPIC_API_KEY (any of them) for the food scanner
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { q, migrate } from './db.js';
import { hashPassword, checkPassword, makeToken, requireUser, requireAdmin, tooMany, ensureAdmin } from './auth.js';
import { analyzePhoto, aiConfigured } from './ai.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 3000;
const SCANS_PER_DAY = +(process.env.SCANS_PER_DAY || 80);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

// The Android app runs on https://localhost inside the phone, so allow cross-origin API calls.
// Logins use a bearer token (no cookies), so this is safe.
app.use('/api', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.set('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/api', express.json({ limit: '25mb' }));

// Never let a database address (it holds the password) reach the logs.
const safe = (e) => String(e?.message || e).replace(/postgres(ql)?://S+/gi, 'postgresql://[hidden]');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const cleanEmail = (e) => String(e || '').trim().toLowerCase();
const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

app.get('/api/health', wrap(async (req, res) => {
  await q('SELECT 1');
  res.json({ ok: true, ai: aiConfigured() });
}));

// ---------- accounts ----------
app.post('/api/auth/register', wrap(async (req, res) => {
  const email = cleanEmail(req.body.email), password = String(req.body.password || ''), name = String(req.body.name || '').trim().slice(0, 80);
  if (tooMany('r:' + req.ip)) return res.status(429).json({ error: 'Too many tries. Wait 10 minutes.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (process.env.ALLOW_SIGNUP === 'false') return res.status(403).json({ error: 'New sign-ups are closed. Ask the admin for an account.' });
  const exists = await q('SELECT 1 FROM users WHERE email = $1', [email]);
  if (exists[0]) return res.status(409).json({ error: 'An account with this email already exists. Log in instead.' });
  const u = (await q('INSERT INTO users (email, name, pass_hash) VALUES ($1, $2, $3) RETURNING id, email, name, role', [email, name, hashPassword(password)]))[0];
  res.json({ token: makeToken(u), user: publicUser(u) });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const email = cleanEmail(req.body.email), password = String(req.body.password || '');
  if (tooMany('l:' + req.ip + ':' + email)) return res.status(429).json({ error: 'Too many tries. Wait 10 minutes.' });
  const u = (await q('SELECT id, email, name, role, pass_hash, disabled FROM users WHERE email = $1', [email]))[0];
  if (!u || !checkPassword(password, u.pass_hash)) return res.status(401).json({ error: 'Wrong email or password.' });
  if (u.disabled) return res.status(403).json({ error: 'This account is turned off. Contact the admin.' });
  await q('UPDATE users SET last_seen = now() WHERE id = $1', [u.id]);
  res.json({ token: makeToken(u), user: publicUser(u) });
}));

app.get('/api/me', requireUser, (req, res) => res.json({ user: publicUser(req.user) }));

app.post('/api/me/password', requireUser, wrap(async (req, res) => {
  const { current, next: nw } = req.body;
  const u = (await q('SELECT pass_hash FROM users WHERE id = $1', [req.user.id]))[0];
  if (!checkPassword(String(current || ''), u.pass_hash)) return res.status(401).json({ error: 'Current password is wrong.' });
  if (String(nw || '').length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  await q('UPDATE users SET pass_hash = $2 WHERE id = $1', [req.user.id, hashPassword(String(nw))]);
  res.json({ ok: true });
}));

// Delete my account and all my data (required by Google Play for apps with accounts).
app.post('/api/me/delete', requireUser, wrap(async (req, res) => {
  const u = (await q('SELECT pass_hash, role FROM users WHERE id = $1', [req.user.id]))[0];
  if (!checkPassword(String(req.body.password || ''), u.pass_hash)) return res.status(401).json({ error: 'Password is wrong.' });
  if (u.role === 'admin') return res.status(400).json({ error: 'The admin account cannot be deleted from the app.' });
  await q('DELETE FROM users WHERE id = $1', [req.user.id]); // photos, data and logs go with it
  res.json({ ok: true });
}));

// ---------- the user's whole app data (profile, days, weights, photo list) ----------
app.get('/api/state', requireUser, wrap(async (req, res) => {
  const r = (await q('SELECT state, updated_at FROM user_state WHERE user_id = $1', [req.user.id]))[0];
  res.json(r ? { state: r.state, updatedAt: r.updated_at } : { state: null, updatedAt: null });
}));

app.put('/api/state', requireUser, wrap(async (req, res) => {
  const s = req.body.state;
  if (!s || typeof s !== 'object' || !s.profile) return res.status(400).json({ error: 'Bad data' });
  const r = await q(`INSERT INTO user_state (user_id, state, updated_at) VALUES ($1, $2, now())
    ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now() RETURNING updated_at`, [req.user.id, JSON.stringify(s)]);
  if (s.profile?.name && s.profile.name !== req.user.name) await q('UPDATE users SET name = $2 WHERE id = $1', [req.user.id, String(s.profile.name).slice(0, 80)]);
  res.json({ updatedAt: r[0].updated_at });
}));

// ---------- food photos ----------
const PHOTO_META = 'id, day, slot, taken_at, created_at, status, name, kcal';
// admins may read any user's photo; everyone else only their own
const ownerClause = (req) => (req.user.role === 'admin' ? ['', []] : [' AND user_id = $2', [req.user.id]]);

app.get('/api/photos', requireUser, wrap(async (req, res) => {
  const rows = req.query.day
    ? await q(`SELECT ${PHOTO_META} FROM food_photos WHERE user_id = $1 AND day = $2 ORDER BY taken_at`, [req.user.id, String(req.query.day)])
    : await q(`SELECT ${PHOTO_META} FROM food_photos WHERE user_id = $1 ORDER BY day`, [req.user.id]);
  res.json(rows);
}));

app.post('/api/photos', requireUser, wrap(async (req, res) => {
  const p = req.body;
  if (!p.id || !p.day || !p.image) return res.status(400).json({ error: 'Missing photo' });
  const r = await q(`INSERT INTO food_photos (id, user_id, day, slot, taken_at, status, name, kcal, image, thumb) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, name = EXCLUDED.name, kcal = EXCLUDED.kcal, slot = EXCLUDED.slot,
      thumb = COALESCE(food_photos.thumb, EXCLUDED.thumb) WHERE food_photos.user_id = $2 RETURNING id`,
  [String(p.id), req.user.id, String(p.day), p.slot || null, p.time || null, p.status || null, p.name || null, p.kcal ? Math.round(p.kcal) : null, p.image, p.thumb || null]);
  if (!r[0]) return res.status(403).json({ error: 'Not your photo' });
  res.json({ ok: true });
}));

app.patch('/api/photos/:id', requireUser, wrap(async (req, res) => {
  const p = req.body;
  if (p.thumb && Object.keys(p).length === 1) await q('UPDATE food_photos SET thumb = $3 WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id, p.thumb]);
  else await q('UPDATE food_photos SET status = $3, name = $4, kcal = $5, slot = $6 WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id, p.status || null, p.name || null, p.kcal ? Math.round(p.kcal) : null, p.slot || null]);
  res.json({ ok: true });
}));

app.get('/api/photos/:id/image', requireUser, wrap(async (req, res) => {
  const [w, a] = ownerClause(req);
  const r = (await q(`SELECT image FROM food_photos WHERE id = $1${w}`, [req.params.id, ...a]))[0];
  res.json({ image: r?.image || null });
}));

app.get('/api/photos/:id/thumb', requireUser, wrap(async (req, res) => {
  const [w, a] = ownerClause(req);
  const r = (await q(`SELECT thumb, CASE WHEN thumb IS NULL THEN image END AS image FROM food_photos WHERE id = $1${w}`, [req.params.id, ...a]))[0];
  res.json(r ? { thumb: r.thumb, image: r.image } : { missing: true });
}));

app.delete('/api/photos/:id', requireUser, wrap(async (req, res) => {
  await q('DELETE FROM food_photos WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

// ---------- AI food scan ----------
app.post('/api/scan', requireUser, wrap(async (req, res) => {
  const { base64, mediaType, mealLabel, remainingKcal } = req.body;
  if (!base64 || base64.length < 100) return res.status(400).json({ error: 'No photo' });
  const n = (await q("SELECT count(*)::int AS n FROM scan_log WHERE user_id = $1 AND at > now() - interval '1 day'", [req.user.id]))[0].n;
  if (n >= SCANS_PER_DAY) return res.status(429).json({ error: 'Daily photo-reading limit reached. Use quick-pick for now.', busy: true });
  try {
    const result = await analyzePhoto({ base64, mediaType: mediaType || 'image/jpeg', mealLabel, remainingKcal });
    q('INSERT INTO scan_log (user_id, ok) VALUES ($1, true)', [req.user.id]).catch(() => {});
    res.json(result);
  } catch (e) {
    q('INSERT INTO scan_log (user_id, ok) VALUES ($1, false)', [req.user.id]).catch(() => {});
    res.status(503).json({ error: e.message, busy: true });
  }
}));

// ---------- admin ----------
app.get('/api/admin/users', requireUser, requireAdmin, wrap(async (req, res) => {
  const rows = await q(`SELECT u.id, u.email, u.name, u.role, u.disabled, u.created_at, u.last_seen, s.updated_at AS synced_at,
      (SELECT count(*)::int FROM food_photos f WHERE f.user_id = u.id) AS photos,
      COALESCE((SELECT count(*)::int FROM jsonb_object_keys(s.state->'days')), 0) AS days,
      s.state->'profile' AS profile
    FROM users u LEFT JOIN user_state s ON s.user_id = u.id ORDER BY u.last_seen DESC NULLS LAST, u.id`);
  res.json(rows);
}));

app.get('/api/admin/users/:id', requireUser, requireAdmin, wrap(async (req, res) => {
  const u = (await q('SELECT id, email, name, role, disabled, created_at, last_seen FROM users WHERE id = $1', [+req.params.id]))[0];
  if (!u) return res.status(404).json({ error: 'No such user' });
  const s = (await q('SELECT state, updated_at FROM user_state WHERE user_id = $1', [u.id]))[0];
  const photos = await q(`SELECT ${PHOTO_META} FROM food_photos WHERE user_id = $1 ORDER BY day DESC, taken_at DESC`, [u.id]);
  res.json({ user: u, state: s?.state || null, syncedAt: s?.updated_at || null, photos });
}));

app.patch('/api/admin/users/:id', requireUser, requireAdmin, wrap(async (req, res) => {
  const id = +req.params.id;
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot change your own admin account here.' });
  if (typeof req.body.disabled === 'boolean') await q('UPDATE users SET disabled = $2 WHERE id = $1', [id, req.body.disabled]);
  if (req.body.role === 'admin' || req.body.role === 'user') await q('UPDATE users SET role = $2 WHERE id = $1', [id, req.body.role]);
  if (req.body.password) {
    if (String(req.body.password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    await q('UPDATE users SET pass_hash = $2 WHERE id = $1', [id, hashPassword(String(req.body.password))]);
  }
  res.json({ ok: true });
}));

app.delete('/api/admin/users/:id', requireUser, requireAdmin, wrap(async (req, res) => {
  const id = +req.params.id;
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete yourself.' });
  await q('DELETE FROM users WHERE id = $1', [id]);
  res.json({ ok: true });
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use('/api', (err, req, res, _next) => {
  console.error('[api]', req.method, req.path, safe(err));
  res.status(err.status || 500).json({ error: err.status === 503 ? err.message : 'Server error. Try again.' });
});

// ---------- web pages ----------
app.use('/admin', express.static(path.join(ROOT, 'server', 'admin')));
app.use(express.static(path.join(ROOT, 'dist'), { index: 'index.html', maxAge: '1h' }));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(ROOT, 'dist', 'index.html')));

// The host may skip "npm run build": build the web app on first start if it is missing.
// (no top-level await: Hostinger loads this file with require())
if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
  import('vite')
    .then(({ build }) => build({ root: ROOT, logLevel: 'warn' }))
    .then(() => console.log('[web] built dist/'))
    .catch((e) => console.error('[web] build failed:', e.message));
}

app.listen(PORT, () => console.log(`VegVital server on :${PORT}`));
migrate().then(ensureAdmin).then(() => console.log('[db] ready')).catch((e) => console.error('[db] setup failed:', safe(e)));
