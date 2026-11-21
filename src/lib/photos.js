// Photo diary: every food photo is kept inside the app (private app storage on the phone,
// localStorage in the browser). The day list lives in state.photos; image bytes live in files.
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { getState, setState, todayKey } from './store.js';
import { MEAL_SLOTS } from '../data/plan.js';

const native = Capacitor.isNativePlatform();
const cache = new Map();

export const newPhotoId = () => 'ph_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export async function savePhotoFile(id, base64) {
  cache.set(id, 'data:image/jpeg;base64,' + base64);
  try {
    if (native) await Filesystem.writeFile({ path: `photos/${id}.jpg`, data: base64, directory: Directory.Data, recursive: true });
    else localStorage.setItem('vv-photo-' + id, base64);
  } catch { /* storage full: the photo still works this session */ }
}

export async function loadPhotoB64(id) {
  const c = cache.get(id);
  if (c) return c.split(',')[1];
  try {
    const b64 = native
      ? (await Filesystem.readFile({ path: `photos/${id}.jpg`, directory: Directory.Data })).data
      : localStorage.getItem('vv-photo-' + id);
    if (typeof b64 === 'string' && b64) { cache.set(id, 'data:image/jpeg;base64,' + b64); return b64; }
  } catch { /* missing */ }
  return null;
}

export function usePhoto(id) {
  const [src, setSrc] = useState(() => (id ? cache.get(id) || null : null));
  useEffect(() => {
    let live = true;
    if (id && !cache.get(id)) loadPhotoB64(id).then((b) => live && b && setSrc('data:image/jpeg;base64,' + b));
    else setSrc(id ? cache.get(id) : null);
    return () => { live = false; };
  }, [id]);
  return src;
}

/** Add / update an entry in the day's photo diary. status: waiting | done | logged | notfood */
export function addDiary(entry) {
  const s = getState();
  const day = entry.day || todayKey();
  const list = [...((s.photos || {})[day] || [])];
  const i = list.findIndex((p) => p.id === entry.id);
  if (i >= 0) list[i] = { ...list[i], ...entry, day };
  else list.push({ time: new Date().toISOString(), ...entry, day });
  list.sort((a, b) => new Date(a.time) - new Date(b.time));
  setState({ photos: { ...(s.photos || {}), [day]: list } });
}

export function updateDiary(id, patch) {
  const s = getState();
  for (const [day, list] of Object.entries(s.photos || {})) {
    if (list.some((p) => p.id === id)) {
      setState({ photos: { ...s.photos, [day]: list.map((p) => (p.id === id ? { ...p, ...patch } : p)) } });
      return;
    }
  }
}

export async function deleteDiary(id) {
  const s = getState();
  const photos = {};
  for (const [day, list] of Object.entries(s.photos || {})) photos[day] = list.filter((p) => p.id !== id);
  setState({ photos, pending: (s.pending || []).filter((p) => p.photoId !== id) });
  cache.delete(id);
  try {
    if (native) await Filesystem.deleteFile({ path: `photos/${id}.jpg`, directory: Directory.Data });
    else localStorage.removeItem('vv-photo-' + id);
  } catch { /* already gone */ }
}

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
/** Which meal a photo taken at this time most likely belongs to */
export function slotAt(date) {
  const n = date.getHours() * 60 + date.getMinutes();
  let best = MEAL_SLOTS[0], diff = 1e9;
  for (const s of MEAL_SLOTS) { const df = Math.abs(toMin(s.time) - n); if (df < diff) { diff = df; best = s; } }
  return best.key;
}
