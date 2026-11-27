// Keeps the user's data (profile, days, weights, photo list) in their account on the server,
// so it shows on any phone or browser they log in from, and the admin can see their reports.
import { App } from '@capacitor/app';
import { getState, replaceState, setQuiet, onChange } from './store.js';
import { api, getSession, loggedIn } from './api.js';

const LOCAL_ONLY = ['pending', 'update', 'pendingDone', 'cloudErr', 'cloudAt', '_serverAt', '_dirty', '_owner', 'lastAutoBackup', 'autoBackupSig', 'lastActive', 'healthConnected'];
let pushTimer = null, pushing = false, started = false, lastPushed = '';
const keepLocal = (s) => Object.fromEntries(['pending', 'lastActive', 'healthConnected'].map((k) => [k, s[k]]));

function forServer(s) {
  const out = { ...s };
  for (const k of LOCAL_ONLY) delete out[k];
  return out;
}

// keep whichever version of a day has more logged
const score = (d) => (d ? Object.keys(d.meals || {}).length * 10 + (d.water || 0) + (d.workouts?.length || 0) * 5 + (d.sleep ? 3 : 0) + (d.extra?.length || 0) * 4 : -1);
function mergeDays(a = {}, b = {}) {
  const days = { ...a };
  for (const [k, d] of Object.entries(b)) if (score(d) > score(days[k])) days[k] = d;
  return days;
}
function mergePhotos(a = {}, b = {}) {
  const out = { ...a };
  for (const [day, list] of Object.entries(b)) {
    const seen = new Set((out[day] || []).map((p) => p.id));
    out[day] = [...(out[day] || []), ...list.filter((p) => !seen.has(p.id))].sort((x, y) => new Date(x.time) - new Date(y.time));
  }
  return out;
}

/** Called right after logging in (and on every app start while logged in). */
export async function pullFromServer() {
  const uid = getSession()?.user?.id;
  if (!uid) return;
  const local = getState();
  const mine = local._owner === uid;
  const r = await api('/api/state');
  if (!r.state) {
    // new account: the data already on this phone (from the old app) becomes this account's data,
    // unless it belongs to someone else who logged out here
    if (local.onboarded && (!local._owner || mine)) { setQuiet({ _owner: uid, _dirty: true }); await pushNow(); }
    else replaceState({ _owner: uid });
    return;
  }
  if (!mine) {
    // first login on this phone: if the old app had data here, keep both
    const merged = !local._owner && local.onboarded
      ? { ...r.state, days: mergeDays(r.state.days, local.days), photos: mergePhotos(r.state.photos, local.photos), ...keepLocal(local) }
      : r.state;
    replaceState({ ...(local._owner ? {} : keepLocal(local)), ...merged, _owner: uid, _serverAt: r.updatedAt, _dirty: !local._owner && local.onboarded });
    if (getState()._dirty) pushSoon(500);
    return;
  }
  if (local._serverAt && new Date(r.updatedAt) <= new Date(local._serverAt)) {
    if (local._dirty) pushSoon(500);
    return; // nothing new on the server
  }
  // changed on another device
  const keep = { ...keepLocal(local), _owner: uid, _serverAt: r.updatedAt };
  if (local._dirty) {
    replaceState({ ...r.state, ...keep, days: mergeDays(r.state.days, local.days), photos: mergePhotos(r.state.photos, local.photos), _dirty: true });
    pushSoon(500);
  } else replaceState({ ...r.state, ...keep, _dirty: false });
}

export async function pushNow() {
  if (!loggedIn() || pushing) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  pushing = true;
  try {
    const s = getState();
    if (!s._owner || s._owner !== getSession()?.user?.id) return;
    const body = JSON.stringify(forServer(s));
    if (body === lastPushed) { setQuiet({ _dirty: false }); return; } // only local details changed
    const r = await api('/api/state', { method: 'PUT', body: { state: JSON.parse(body) }, timeout: 60000 });
    lastPushed = body;
    // only clear the flag if nothing changed while uploading
    setQuiet({ _serverAt: r.updatedAt, _dirty: getState() !== s });
    if (getState()._dirty) pushSoon();
  } catch { /* offline: try again later */ } finally { pushing = false; }
}

export function pushSoon(ms = 8000) {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, ms);
}

export function startSync() {
  if (started) return;
  started = true;
  onChange(() => {
    if (!loggedIn()) return;
    if (!getState()._dirty) setQuiet({ _dirty: true });
    pushSoon();
  });
  setInterval(() => { if (loggedIn()) (getState()._dirty ? pushNow() : pullFromServer().catch(() => {})); }, 5 * 60000);
  if (typeof window !== 'undefined') window.addEventListener('online', () => pushSoon(1000));
  try {
    App.addListener('appStateChange', ({ isActive }) => {
      if (!loggedIn()) return;
      if (isActive) pullFromServer().catch(() => {});
      else pushNow();
    });
  } catch { /* web */ }
}
