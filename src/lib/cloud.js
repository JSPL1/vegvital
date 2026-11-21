// Cloud photo store on Neon (free Postgres). Each food photo is saved in the app first, then
// uploaded here. Once it is safely in the cloud (and the AI has read it) the phone keeps only
// a tiny thumbnail; the full photo is fetched from Neon when you open it — on any device.
import { neon } from '@neondatabase/serverless';
import { getState, setState } from './store.js';

let sqlFn = null, sqlUrl = '', tableReady = false, syncing = false;

function sql() {
  const url = (getState().profile.neonUrl || '').trim();
  if (!url) return null;
  if (url !== sqlUrl) { sqlFn = neon(url, { disableWarningInBrowsers: true }); sqlUrl = url; tableReady = false; }
  return sqlFn;
}

export const cloudOn = () => !!(getState().profile.neonUrl || '').trim();

async function ensureTable(q) {
  if (tableReady) return;
  await q.query(`CREATE TABLE IF NOT EXISTS food_photos (
    id text PRIMARY KEY, day text NOT NULL, slot text, taken_at timestamptz, status text,
    name text, kcal int, image text, created_at timestamptz DEFAULT now())`);
  await q.query('CREATE INDEX IF NOT EXISTS food_photos_day ON food_photos(day)');
  tableReady = true;
}

/** Check a connection string works (used by the Settings "Save" button). */
export async function testCloud(url) {
  const q = neon(url.trim(), { disableWarningInBrowsers: true });
  tableReady = false; sqlUrl = url.trim(); sqlFn = q;
  await ensureTable(q);
  const r = await q.query('SELECT count(*)::int AS n FROM food_photos');
  return r[0]?.n ?? 0;
}

export async function cloudImage(id) {
  const q = sql(); if (!q) return null;
  await ensureTable(q);
  const r = await q.query('SELECT image FROM food_photos WHERE id = $1', [id]);
  return r[0]?.image || null;
}

/** Upload new photos and changed details. `loadLocal(id)` returns local base64 or null; `afterUpload(entry)` lets the caller free local space. */
export async function syncPhotos(loadLocal, afterUpload) {
  const q = sql();
  if (!q || syncing) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  syncing = true;
  try {
    await ensureTable(q);
    const all = Object.values(getState().photos || {}).flat().filter((p) => !p.cloud || p.cloudDirty);
    for (const p of all) {
      if (!p.cloud) {
        const img = await loadLocal(p.id);
        if (!img) { mark(p.id, { cloud: true, cloudDirty: false }); continue; }
        await q.query(
          `INSERT INTO food_photos (id, day, slot, taken_at, status, name, kcal, image) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, name = EXCLUDED.name, kcal = EXCLUDED.kcal, slot = EXCLUDED.slot`,
          [p.id, p.day, p.slot, p.time, p.status, p.name || null, p.kcal || null, img],
        );
      } else {
        await q.query('UPDATE food_photos SET status=$2, name=$3, kcal=$4, slot=$5 WHERE id=$1', [p.id, p.status, p.name || null, p.kcal || null, p.slot]);
      }
      mark(p.id, { cloud: true, cloudDirty: false });
      await afterUpload?.({ ...p, cloud: true });
    }
    setState({ cloudErr: '', cloudAt: new Date().toISOString() });
  } catch (e) {
    setState({ cloudErr: String(e?.message || e).slice(0, 140) });
  } finally {
    syncing = false;
  }
}

/** Photos saved from another phone/PC show up here too. */
export async function pullDay(day) {
  const q = sql(); if (!q) return;
  try {
    await ensureTable(q);
    const rows = await q.query('SELECT id, day, slot, taken_at, status, name, kcal FROM food_photos WHERE day = $1 ORDER BY taken_at', [day]);
    const s = getState();
    const list = [...((s.photos || {})[day] || [])];
    let added = 0;
    for (const r of rows) {
      if (list.some((p) => p.id === r.id)) continue;
      list.push({ id: r.id, day: r.day, slot: r.slot, time: new Date(r.taken_at).toISOString(), status: r.status, name: r.name, kcal: r.kcal, cloud: true, remote: true });
      added++;
    }
    if (added) {
      list.sort((a, b) => new Date(a.time) - new Date(b.time));
      setState({ photos: { ...(s.photos || {}), [day]: list } });
    }
  } catch (e) { setState({ cloudErr: String(e?.message || e).slice(0, 140) }); }
}

export async function cloudDelete(id) {
  const q = sql(); if (!q) return;
  try { await q.query('DELETE FROM food_photos WHERE id = $1', [id]); } catch { /* offline: ignore */ }
}

function mark(id, patch) {
  const s = getState();
  const photos = {};
  for (const [d, list] of Object.entries(s.photos || {})) photos[d] = list.map((p) => (p.id === id ? { ...p, ...patch } : p));
  setState({ photos });
}
