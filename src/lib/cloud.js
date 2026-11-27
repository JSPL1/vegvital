// Cloud photo store: each food photo is saved in the app first, then uploaded to your account on
// the VegVital server (full photo + small thumbnail, stored in Neon). Once it is safely in the
// cloud the phone deletes both; pictures are fetched from the server when shown — on any device.
import { getState, setState } from './store.js';
import { api, loggedIn } from './api.js';

let syncing = false;

export const cloudOn = () => loggedIn();

export async function cloudImage(id) {
  if (!cloudOn()) return null;
  return (await api(`/api/photos/${encodeURIComponent(id)}/image`)).image || null;
}

/** Small picture for lists; falls back to the full photo for very old uploads. */
export async function cloudThumb(id) {
  if (!cloudOn()) return null;
  return api(`/api/photos/${encodeURIComponent(id)}/thumb`);
}

export async function cloudSetThumb(id, thumb) {
  if (!cloudOn()) return;
  await api(`/api/photos/${encodeURIComponent(id)}`, { method: 'PATCH', body: { thumb } });
}

/** Upload new photos and changed details. `loadLocal(id)` returns {img, thumb} base64 from the phone; `afterUpload(entry)` lets the caller free local space. */
export async function syncPhotos(loadLocal, afterUpload) {
  if (!cloudOn() || syncing) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  syncing = true;
  try {
    const all = Object.values(getState().photos || {}).flat().filter((p) => (!p.cloud && !p.lost) || p.cloudDirty);
    for (const p of all) {
      if (!p.cloud) {
        const { img, thumb } = await loadLocal(p.id);
        if (!img) { mark(p.id, { lost: true, cloudDirty: false }); continue; }
        await api('/api/photos', { method: 'POST', timeout: 90000, body: { id: p.id, day: p.day, slot: p.slot, time: p.time, status: p.status, name: p.name, kcal: p.kcal, image: img, thumb } });
      } else {
        await api(`/api/photos/${encodeURIComponent(p.id)}`, { method: 'PATCH', body: { status: p.status, name: p.name, kcal: p.kcal, slot: p.slot } });
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

function mergeRows(rows) {
  const s = getState();
  const photos = { ...(s.photos || {}) };
  const known = new Set(Object.values(photos).flat().map((p) => p.id));
  let added = 0;
  for (const r of rows) {
    if (known.has(r.id)) continue;
    const list = [...(photos[r.day] || [])];
    list.push({ id: r.id, day: r.day, slot: r.slot, time: new Date(r.taken_at || r.created_at || Date.now()).toISOString(), status: r.status, name: r.name, kcal: r.kcal, cloud: true, remote: true, gone: true });
    list.sort((a, b) => new Date(a.time) - new Date(b.time));
    photos[r.day] = list;
    added++;
  }
  if (added) setState({ photos });
  return added;
}

/** Photos saved from another phone/PC show up here too. */
export async function pullDay(day) {
  if (!cloudOn()) return;
  try { mergeRows(await api('/api/photos?day=' + encodeURIComponent(day))); } catch (e) { setState({ cloudErr: String(e?.message || e).slice(0, 140) }); }
}

/** Every photo ever uploaded (details only, no pictures) — brings old photos back after a reinstall. */
export async function pullAll() {
  if (!cloudOn()) return 0;
  try { return mergeRows(await api('/api/photos')); } catch (e) { setState({ cloudErr: String(e?.message || e).slice(0, 140) }); return 0; }
}

export async function cloudDelete(id) {
  if (!cloudOn()) return;
  try { await api(`/api/photos/${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch { /* offline: ignore */ }
}

function mark(id, patch) {
  const s = getState();
  const photos = {};
  for (const [d, list] of Object.entries(s.photos || {})) photos[d] = list.map((p) => (p.id === id ? { ...p, ...patch } : p));
  setState({ photos });
}
