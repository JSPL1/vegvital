// Photo diary: every food photo is kept inside the app (private app storage on the phone,
// localStorage in the browser). The day list lives in state.photos; image bytes live in files.
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { getState, setState, todayKey } from './store.js';
import { MEAL_SLOTS } from '../data/plan.js';
import { shrinkImage } from './ai.js';
import { cloudImage, syncPhotos, cloudDelete, cloudOn } from './cloud.js';

const native = Capacitor.isNativePlatform();
const cache = new Map();

export const newPhotoId = () => 'ph_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function writeLocal(name, base64) {
  if (native) await Filesystem.writeFile({ path: `photos/${name}.jpg`, data: base64, directory: Directory.Data, recursive: true });
  else localStorage.setItem('vv-photo-' + name, base64);
}
async function readLocal(name) {
  try {
    const b = native ? (await Filesystem.readFile({ path: `photos/${name}.jpg`, directory: Directory.Data })).data : localStorage.getItem('vv-photo-' + name);
    return typeof b === 'string' && b ? b : null;
  } catch { return null; }
}
async function removeLocal(name) {
  try {
    if (native) await Filesystem.deleteFile({ path: `photos/${name}.jpg`, directory: Directory.Data });
    else localStorage.removeItem('vv-photo-' + name);
  } catch { /* already gone */ }
}

export async function savePhotoFile(id, base64) {
  cache.set(id, 'data:image/jpeg;base64,' + base64);
  try { await writeLocal(id, base64); } catch { /* storage full: the photo still works this session */ }
  try {
    const t = await shrinkImage('data:image/jpeg;base64,' + base64, 220);
    cache.set(id + '_t', t.dataUrl);
    await writeLocal(id + '_t', t.base64);
  } catch { /* thumbnail optional */ }
}

/** Full photo: from the phone if still there, otherwise from the cloud. */
export async function loadPhotoB64(id, { localOnly = false } = {}) {
  const c = cache.get(id);
  if (c) return c.split(',')[1];
  let b64 = await readLocal(id);
  if (!b64 && !localOnly && cloudOn()) { try { b64 = await cloudImage(id); } catch { b64 = null; } }
  if (b64) { cache.set(id, 'data:image/jpeg;base64,' + b64); return b64; }
  return null;
}

async function loadThumb(id) {
  const c = cache.get(id + '_t');
  if (c) return c;
  const b = await readLocal(id + '_t');
  if (b) { const u = 'data:image/jpeg;base64,' + b; cache.set(id + '_t', u); return u; }
  const full = await loadPhotoB64(id);
  return full ? 'data:image/jpeg;base64,' + full : null;
}

export function usePhoto(id, { thumb = false } = {}) {
  const key = thumb ? id + '_t' : id;
  const [src, setSrc] = useState(() => (id ? cache.get(key) || null : null));
  useEffect(() => {
    let live = true;
    if (!id) { setSrc(null); return undefined; }
    if (cache.get(key)) setSrc(cache.get(key));
    else (thumb ? loadThumb(id) : loadPhotoB64(id).then((b) => b && 'data:image/jpeg;base64,' + b)).then((u) => live && u && setSrc(u));
    return () => { live = false; };
  }, [id, thumb]);
  return src;
}

// ---- cloud sync: upload, then keep only the thumbnail on the phone ----
const FINAL = ['done', 'logged', 'notfood'];
let syncTimer = null;
export function cloudSyncSoon(ms = 1500) {
  if (!cloudOn()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(runCloudSync, ms);
}
export async function runCloudSync() {
  if (!cloudOn()) return;
  await syncPhotos((id) => loadPhotoB64(id, { localOnly: true }), async (p) => {
    if (FINAL.includes(p.status)) { await removeLocal(p.id); cache.delete(p.id); }
  });
  // photos uploaded earlier whose AI result came later: free their space too
  const s = getState();
  for (const p of Object.values(s.photos || {}).flat()) if (p.cloud && !p.cloudDirty && FINAL.includes(p.status) && !p.slim) {
    await removeLocal(p.id); cache.delete(p.id);
    updateDiary(p.id, { slim: true }, true);
  }
}

/** Add / update an entry in the day's photo diary. status: waiting | done | logged | notfood */
export function addDiary(entry) {
  const s = getState();
  const day = entry.day || todayKey();
  const list = [...((s.photos || {})[day] || [])];
  const i = list.findIndex((p) => p.id === entry.id);
  if (i >= 0) list[i] = { ...list[i], ...entry, day, cloudDirty: !!list[i].cloud };
  else list.push({ time: new Date().toISOString(), ...entry, day });
  list.sort((a, b) => new Date(a.time) - new Date(b.time));
  setState({ photos: { ...(s.photos || {}), [day]: list } });
  cloudSyncSoon();
}

export function updateDiary(id, patch, quiet) {
  const s = getState();
  for (const [day, list] of Object.entries(s.photos || {})) {
    if (list.some((p) => p.id === id)) {
      setState({ photos: { ...s.photos, [day]: list.map((p) => (p.id === id ? { ...p, ...patch, ...(quiet ? {} : { cloudDirty: !!p.cloud }) } : p)) } });
      if (!quiet) cloudSyncSoon();
      return;
    }
  }
}

export async function deleteDiary(id) {
  const s = getState();
  const photos = {};
  for (const [day, list] of Object.entries(s.photos || {})) photos[day] = list.filter((p) => p.id !== id);
  setState({ photos, pending: (s.pending || []).filter((p) => p.photoId !== id) });
  cache.delete(id); cache.delete(id + '_t');
  await removeLocal(id); await removeLocal(id + '_t');
  cloudDelete(id);
}

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
/** Which meal a photo taken at this time most likely belongs to */
export function slotAt(date) {
  const n = date.getHours() * 60 + date.getMinutes();
  let best = MEAL_SLOTS[0], diff = 1e9;
  for (const s of MEAL_SLOTS) { const df = Math.abs(toMin(s.time) - n); if (df < diff) { diff = df; best = s; } }
  return best.key;
}
