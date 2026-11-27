// Photos waiting for the AI (Google busy, offline, or bulk-added from the gallery) are queued
// here and analysed automatically in the background, a few at a time. When the AI answers,
// its numbers replace the quick-pick estimate or fill the meal for that photo.
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { getState, setState, todayKey } from './store.js';
import { analyzeWithProfile, activeProvider, shrinkImage } from './ai.js';
import { MEAL_SLOTS } from '../data/plan.js';
import { sumNutrition } from '../data/foods.js';
import { newPhotoId, savePhotoFile, loadPhotoB64, addDiary, updateDiary, slotAt } from './photos.js';
import { photoTakenAt } from './photoDate.js';

const MAX_TRIES = 60;
const MAX_AGE_MS = 7 * 86400e3;
const GAP_MS = 5000; // pause between photos so the free AI tier is not overloaded

export function queuePhoto({ base64, photoId, slot, day = todayKey(), time = new Date().toISOString() }) {
  const id = 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const item = { id, slot, day, time, photoId, tries: 0, lastErr: '' };
  if (!photoId) item.b64 = base64; // older path: keep bytes inline
  setState({ pending: [...(getState().pending || []), item].slice(-40) });
  if (photoId) updateDiary(photoId, { status: 'waiting' });
  return id;
}

export const pendingCount = () => (getState().pending || []).length;

let running = false;
export async function processPending() {
  const { profile } = getState();
  if (running || activeProvider(profile) === 'offline' || !(getState().pending || []).length) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  running = true;
  let fixed = 0;
  try {
    for (const item of [...(getState().pending || [])]) {
      const tooOld = Date.now() - new Date(item.time) > MAX_AGE_MS || item.tries >= MAX_TRIES;
      if (tooOld) { drop(item.id); continue; }
      const b64 = item.b64 || (item.photoId && (await loadPhotoB64(item.photoId)));
      if (!b64) { drop(item.id); continue; }
      try {
        const label = MEAL_SLOTS.find((s) => s.key === item.slot)?.label;
        const r = await analyzeWithProfile(getState().profile, { base64: b64, mealLabel: label, remainingKcal: 0 });
        if (r.is_food && r.items.length) {
          applyResult(item, r);
          fixed++;
          if (item.photoId) updateDiary(item.photoId, { status: 'done', name: r.meal_name, kcal: Math.round(sumNutrition(r.items).kcal) });
        } else if (item.photoId) updateDiary(item.photoId, { status: 'notfood' });
        drop(item.id);
      } catch (e) {
        const msg = String(e?.message || e);
        if (e?.status === 401) break; // logged out: stop until the user logs in again
        setState({ pending: (getState().pending || []).map((p) => (p.id === item.id ? { ...p, tries: p.tries + 1, lastErr: msg.slice(0, 140) } : p)) });
        break; // Google still busy: try again next round
      }
      await new Promise((r) => setTimeout(r, GAP_MS));
    }
  } finally {
    running = false;
  }
  if (fixed) setState({ pendingDone: { count: fixed, at: Date.now() } });
}

function drop(id) {
  setState({ pending: (getState().pending || []).filter((p) => p.id !== id) });
}

function applyResult(item, r) {
  const s = getState();
  const day = { ...(s.days[item.day] || { meals: {} }) };
  const meals = { ...(day.meals || {}) };
  const cur = meals[item.slot];
  const meal = { items: r.items, source: 'photo', time: item.time, name: r.meal_name, score: r.health_score, refined: true, photoId: item.photoId };
  // replace the quick-pick estimate made for this photo, or fill an empty / auto-planned slot
  if (!cur || cur.pendingId === item.id || (item.photoId && cur.photoId === item.photoId) || cur.source === 'plan-auto') {
    meals[item.slot] = meal;
  } else {
    // slot already has a different meal → keep both
    day.extra = [...(day.extra || []), { ...meal, slot: item.slot }];
  }
  day.meals = meals;
  setState({ days: { ...s.days, [item.day]: day } });
}

// ---------- bulk add from the gallery ----------

async function blobToDataUrl(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
}

function exifDate(exif) {
  const v = exif?.DateTimeOriginal || exif?.DateTime || exif?.DateTimeDigitized;
  if (!v || typeof v !== 'string') return null;
  const m = v.match(/(\d{4})[:-](\d\d)[:-](\d\d)[ T](\d\d):(\d\d)/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
}

/** Let the user pick many food photos; each is stored and queued for the AI. Returns how many were added. */
export async function importGalleryPhotos() {
  // The original files are read (not a resized copy) so the date the photo was TAKEN is known:
  // yesterday's lunch photo goes into yesterday's lunch, not today.
  const files = await new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
    input.onchange = () => resolve([...(input.files || [])]);
    input.addEventListener('cancel', () => resolve([]));
    input.click();
  });
  let picked = []; // [{dataUrl, date}]
  for (const f of files.slice(0, 40)) picked.push({ dataUrl: await blobToDataUrl(f), date: await photoTakenAt(f) });

  for (const p of picked) {
    const small = await shrinkImage(p.dataUrl, 768);
    const photoId = newPhotoId();
    const day = todayKey(p.date);
    const slot = slotAt(p.date);
    await savePhotoFile(photoId, small.base64);
    addDiary({ id: photoId, day, slot, time: p.date.toISOString(), status: 'waiting', from: 'gallery' });
    queuePhoto({ photoId, slot, day, time: p.date.toISOString() });
  }
  if (picked.length) setTimeout(processPending, 500);
  return picked.length;
}
