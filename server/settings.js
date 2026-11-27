// Settings the admin can change on the admin page (stored in Neon). Each falls back to the
// host's environment variable, so the server keeps working before anything is saved here.
import { q } from './db.js';

export const EDITABLE = {
  GEMINI_API_KEY: { label: 'Google Gemini API key', secret: true, hint: 'aistudio.google.com/apikey · free tier' },
  GROQ_API_KEY: { label: 'Groq API key', secret: true, hint: 'console.groq.com/keys · free backup AI' },
  ANTHROPIC_API_KEY: { label: 'Anthropic Claude API key', secret: true, hint: 'console.anthropic.com · paid, optional' },
  CALORIEMAMA_API_KEY: { label: 'Calorie Mama API key (user_key)', secret: true, hint: 'dev.caloriemama.ai · food photo recognition' },
  GEMINI_MODEL: { label: 'Gemini model (optional)', hint: 'e.g. gemini-2.5-flash — empty = automatic' },
  GROQ_MODEL: { label: 'Groq model (optional)', hint: 'e.g. meta-llama/llama-4-scout-17b-16e-instruct — empty = automatic' },
  CLAUDE_MODEL: { label: 'Claude model (optional)', hint: 'default claude-haiku-5-5' },
  AI_ORDER: { label: 'AI order', hint: 'comma list of gemini,groq,claude,caloriemama — default groq,gemini,caloriemama,claude' },
  SCANS_PER_DAY: { label: 'Photo readings per user per day', hint: 'default 80' },
  ALLOW_SIGNUP: { label: 'Allow new sign-ups', hint: 'true or false' },
  OFF_ENABLED: { label: 'Open Food Facts lookups', hint: 'true or false — packaged foods by barcode / name' },
};

let cache = {}, loadedAt = 0;

export async function loadSettings(force = false) {
  if (!force && Date.now() - loadedAt < 30000) return cache;
  try {
    await q('CREATE TABLE IF NOT EXISTS app_settings (key text PRIMARY KEY, value text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())');
    const rows = await q('SELECT key, value FROM app_settings');
    cache = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    loadedAt = Date.now();
  } catch { /* database down: keep the last copy */ }
  return cache;
}

/** Value from the admin page, else the environment variable, else the default. */
export function setting(key, def = '') {
  const v = cache[key];
  if (v !== undefined && v !== '') return v;
  return process.env[key] ?? def;
}

export const source = (key) => (cache[key] ? 'admin page' : process.env[key] ? 'server settings (Hostinger)' : 'not set');

export async function saveSetting(key, value) {
  if (!EDITABLE[key]) throw Object.assign(new Error('Unknown setting'), { status: 400 });
  const v = String(value ?? '').trim();
  if (v) await q(`INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [key, v]);
  else await q('DELETE FROM app_settings WHERE key = $1', [key]);
  await loadSettings(true);
}

// "Validated" mark: saved when a test with this exact key passes; it no longer matches once the key changes.
import crypto from 'node:crypto';
const fp = (v) => crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 16);
export const KEY_OF = { gemini: 'GEMINI_API_KEY', groq: 'GROQ_API_KEY', claude: 'ANTHROPIC_API_KEY' };
export async function markValidated(key, how) {
  const v = setting(key); if (!v) return;
  await q(`INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, ['VALID:' + key, JSON.stringify({ fp: fp(v), at: new Date().toISOString(), how })]);
  await loadSettings(true);
}
export function validated(key) {
  try { const m = JSON.parse(cache['VALID:' + key] || 'null'); return m && setting(key) && m.fp === fp(setting(key)) ? m : null; } catch { return null; }
}

export const mask = (v) => (!v ? '' : v.length <= 8 ? '••••' : `${v.slice(0, 4)}••••${v.slice(-4)}`);
