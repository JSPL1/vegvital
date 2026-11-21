// Photos that couldn't be analysed (Google busy / offline) are queued here and
// re-tried automatically in the background. When the AI finally answers, its
// accurate numbers replace the quick-pick estimate for that meal.
import { getState, setState, todayKey } from './store.js';
import { analyzeWithProfile, activeProvider } from './ai.js';
import { MEAL_SLOTS } from '../data/plan.js';

const MAX_TRIES = 40;          // ~2 days of background retries
const MAX_AGE_MS = 3 * 86400e3;

export function queuePhoto({ base64, slot, day = todayKey() }) {
  const id = 'p_' + Date.now().toString(36);
  const item = { id, slot, day, time: new Date().toISOString(), b64: base64, tries: 0, lastErr: '' };
  // keep at most 8 queued photos so storage stays small
  setState({ pending: [...(getState().pending || []), item].slice(-8) });
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
  for (const item of [...(getState().pending || [])]) {
    const tooOld = Date.now() - new Date(item.time) > MAX_AGE_MS || item.tries >= MAX_TRIES;
    if (tooOld) { drop(item.id); continue; }
    try {
      const label = MEAL_SLOTS.find((s) => s.key === item.slot)?.label;
      const r = await analyzeWithProfile(getState().profile, { base64: item.b64, mealLabel: label, remainingKcal: 0 });
      if (r.is_food && r.items.length) {
        applyResult(item, r);
        fixed++;
      }
      drop(item.id);
    } catch (e) {
      const msg = String(e?.message || e);
      if (/invalid/i.test(msg)) { running = false; return; } // bad key: stop until user fixes it
      setState({ pending: (getState().pending || []).map((p) => (p.id === item.id ? { ...p, tries: p.tries + 1, lastErr: msg.slice(0, 140) } : p)) });
      break; // Google still busy — try again next round
    }
  }
  running = false;
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
  // replace the quick-pick estimate made for this photo, or fill an empty / auto-planned slot
  if (!cur || cur.pendingId === item.id || cur.source === 'plan-auto') {
    meals[item.slot] = { items: r.items, source: 'photo', time: item.time, name: r.meal_name, score: r.health_score, refined: true };
  } else {
    // slot already has a different meal → keep both
    day.extra = [...(day.extra || []), { items: r.items, slot: item.slot, name: r.meal_name, time: item.time }];
  }
  day.meals = meals;
  setState({ days: { ...s.days, [item.day]: day } });
}
