// Everything that happens automatically, so you almost never type anything:
//  • steps + sleep + active calories from Health Connect (phone / smartwatch / Google Fit)
//  • on-phone step counter fallback (accelerometer) while the app is open
//  • sleep estimate from overnight phone inactivity when no watch data exists
//  • planned meals auto-logged once their time window passes (photo overrides)
//  • reminders for meals, water, desk breaks and wind-down
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Motion } from '@capacitor/motion';
import { App } from '@capacitor/app';
import { Health } from '@capgo/capacitor-health';
import { getState, setState, updateDay, todayKey, getDay } from './store.js';
import { planForDate, MEAL_SLOTS } from '../data/plan.js';

const native = Capacitor.isNativePlatform();
// Everything your smartwatch / Samsung Health / Google Fit / Fitbit puts into Health Connect
const READ = ['steps', 'sleep', 'calories', 'totalCalories', 'heartRate', 'restingHeartRate', 'oxygenSaturation',
  'heartRateVariability', 'weight', 'workouts', 'dietaryWater', 'distance'];
// What VegVital writes back so your watch app shows it too
const WRITE = ['calories', 'dietaryWater', 'dietaryEnergyConsumed', 'dietaryProtein', 'mindfulness'];

const WORKOUT_NAMES = {
  walking: 'Walk 🚶', running: 'Run 🏃', runningTreadmill: 'Treadmill 🏃', cycling: 'Cycling 🚴', bikingStationary: 'Indoor bike 🚴',
  yoga: 'Yoga 🧘', swimming: 'Swim 🏊', swimmingPool: 'Swim 🏊', strengthTraining: 'Strength 💪', traditionalStrengthTraining: 'Strength 💪',
  functionalStrengthTraining: 'Strength 💪', highIntensityIntervalTraining: 'HIIT 🔥', hiking: 'Hike 🥾', elliptical: 'Elliptical',
  dance: 'Dance 💃', badminton: 'Badminton 🏸', cricket: 'Cricket 🏏', stairClimbing: 'Stairs', other: 'Workout',
};

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

// ---------- Health Connect ----------
export async function healthAvailable() {
  if (!native) return false;
  try { return (await Health.isAvailable()).available; } catch { return false; }
}

export async function connectHealth() {
  if (!(await healthAvailable())) return { ok: false, reason: 'Health Connect not available on this phone' };
  try {
    const r = await Health.requestAuthorization({ read: READ, write: WRITE });
    setState({ healthConnected: r.readAuthorized.length > 0, healthWrite: r.writeAuthorized || [] });
    await syncHealth();
    return { ok: r.readAuthorized.length > 0 };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
}

export async function syncHealth() {
  if (!getState().healthConnected || !(await healthAvailable())) return;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const iso = (d) => d.toISOString();
  try {
    const steps = await Health.queryAggregated({ dataType: 'steps', startDate: iso(start), endDate: iso(new Date()), bucket: 'day', aggregation: 'sum' });
    const total = steps.samples.reduce((a, s) => a + (s.value || 0), 0);
    if (total > 0) updateDay((d) => ({ ...d, steps: Math.round(total), stepsSource: 'Health Connect' }));
  } catch { /* no permission */ }
  try {
    const cal = await Health.queryAggregated({ dataType: 'calories', startDate: iso(start), endDate: iso(new Date()), bucket: 'day', aggregation: 'sum' });
    const total = cal.samples.reduce((a, s) => a + (s.value || 0), 0);
    if (total > 0) updateDay((d) => ({ ...d, activeKcal: Math.round(total) }));
  } catch { /* ignore */ }
  try {
    const from = new Date(start.getTime() - 12 * 3600e3); // yesterday noon
    const res = await Health.readSamples({ dataType: 'sleep', startDate: iso(from), endDate: iso(new Date()), limit: 50, ascending: true });
    const asleep = res.samples.filter((s) => s.sleepState !== 'awake' && s.sleepState !== 'inBed' || !s.sleepState);
    if (asleep.length) {
      const st = new Date(asleep[0].startDate);
      const en = new Date(asleep[asleep.length - 1].endDate);
      const mins = asleep.reduce((a, s) => a + (new Date(s.endDate) - new Date(s.startDate)) / 60000, 0);
      const stages = {};
      asleep.forEach((s) => (s.stages || []).forEach((g) => { stages[g.stage] = (stages[g.stage] || 0) + g.durationMinutes; }));
      updateDay((d) => ({ ...d, sleep: { start: st.toISOString(), end: en.toISOString(), mins: Math.round(mins), source: 'Health Connect', stages } }));
    }
  } catch { /* ignore */ }
  try {
    const w = await Health.readSamples({ dataType: 'weight', limit: 1 });
    const s = w.samples[0];
    if (s) {
      const date = s.startDate.slice(0, 10);
      const weights = getState().weights.filter((x) => x.date !== date).concat({ date, kg: s.value });
      setState({ weights });
    }
  } catch { /* ignore */ }

  // ---- smartwatch vitals ----
  const vitals = {};
  let device = getState().watch?.device || null;
  try {
    const hr = await Health.readSamples({ dataType: 'heartRate', startDate: iso(start), endDate: iso(new Date()), limit: 500, ascending: true });
    const v = hr.samples.map((s) => s.value).filter(Boolean);
    if (v.length) {
      const last = hr.samples[hr.samples.length - 1];
      vitals.hr = Math.round(last.value); vitals.hrAt = last.endDate;
      vitals.hrMin = Math.round(Math.min(...v)); vitals.hrMax = Math.round(Math.max(...v));
      vitals.hrAvg = Math.round(v.reduce((a, b) => a + b, 0) / v.length);
      // hourly trend for the sparkline
      const buckets = Array(24).fill(null);
      hr.samples.forEach((s) => { const h = new Date(s.startDate).getHours(); buckets[h] = buckets[h] == null ? s.value : (buckets[h] + s.value) / 2; });
      vitals.hrTrend = buckets.map((x) => (x == null ? 0 : Math.round(x)));
      device = last.sourceName || last.deviceType || device;
    }
  } catch { /* no watch HR */ }
  const latest = async (dataType, key, round = 0) => {
    try {
      const r = await Health.readSamples({ dataType, startDate: iso(new Date(Date.now() - 3 * 86400e3)), endDate: iso(new Date()), limit: 20 });
      const s = r.samples.sort((a, b) => new Date(b.endDate) - new Date(a.endDate))[0];
      if (s) { vitals[key] = +s.value.toFixed(round); device = device || s.sourceName; }
    } catch { /* ignore */ }
  };
  await latest('restingHeartRate', 'rhr');
  await latest('oxygenSaturation', 'spo2');
  await latest('heartRateVariability', 'hrv');
  try {
    const d = await Health.queryAggregated({ dataType: 'distance', startDate: iso(start), endDate: iso(new Date()), bucket: 'day', aggregation: 'sum' });
    const m = d.samples.reduce((a, s) => a + (s.value || 0), 0);
    if (m > 0) vitals.km = +(m / 1000).toFixed(2);
  } catch { /* ignore */ }
  try {
    const tc = await Health.queryAggregated({ dataType: 'totalCalories', startDate: iso(start), endDate: iso(new Date()), bucket: 'day', aggregation: 'sum' });
    const k = tc.samples.reduce((a, s) => a + (s.value || 0), 0);
    if (k > 0) vitals.totalKcal = Math.round(k);
  } catch { /* ignore */ }

  // ---- workouts recorded on the watch ----
  try {
    const w = await Health.queryWorkouts({ startDate: iso(start), endDate: iso(new Date()), limit: 30 });
    const ours = 'VegVital';
    const list = (w.workouts || [])
      .filter((x) => !(x.sourceName || '').includes(ours))
      .map((x) => ({
        id: x.platformId || x.startDate, type: x.workoutType, title: WORKOUT_NAMES[x.workoutType] || x.workoutType,
        mins: Math.round((x.duration || 0) / 60), kcal: Math.round(x.totalEnergyBurned || 0),
        km: x.totalDistance ? +(x.totalDistance / 1000).toFixed(2) : 0, time: x.startDate, source: x.sourceName || 'Watch',
      }));
    updateDay((d) => ({ ...d, watchWorkouts: list }));
    if (list[0]) device = device || list[0].source;
  } catch { /* ignore */ }

  // ---- water logged on the watch ----
  try {
    const wa = await Health.queryAggregated({ dataType: 'dietaryWater', startDate: iso(start), endDate: iso(new Date()), bucket: 'day', aggregation: 'sum' });
    const litres = wa.samples.reduce((a, s) => a + (s.value || 0), 0);
    const glasses = Math.round(litres / 0.25);
    // Health Connect total already includes the glasses we wrote; if it's higher, the watch logged extra
    if (glasses > (getDay().water || 0)) {
      updateDay((d) => ({ ...d, water: glasses, hcWritten: { ...(d.hcWritten || {}), water: glasses } }));
    }
  } catch { /* ignore */ }

  setState({ watch: { ...(getState().watch || {}), ...vitals, device, lastSync: new Date().toISOString() } });
  await writeBack();
}

// ---------- write VegVital data back to Health Connect (shows on your watch app) ----------
let writing = false;
export async function writeBack() {
  if (writing || !getState().healthConnected || !native) return;
  writing = true;
  try {
    const r = await Health.checkAuthorization({ read: READ, write: WRITE });
    setState({ healthWrite: r.writeAuthorized || [] });
  } catch { /* keep last known */ }
  const can = new Set(getState().healthWrite || []);
  try {
    const day = getDay();
    const done = day.hcWritten || { water: 0, kcal: 0, p: 0, workouts: [] };
    const now = new Date(), earlier = new Date(Date.now() - 60000);
    const iso = (d) => d.toISOString();
    const next = { ...done, workouts: [...(done.workouts || [])] };
    // water: one sample for every glass not yet written
    const dw = (day.water || 0) - (done.water || 0);
    if (dw > 0 && can.has('dietaryWater')) {
      await Health.saveSample({ dataType: 'dietaryWater', value: dw * 0.25, unit: 'liter', startDate: iso(earlier), endDate: iso(now) });
      next.water = day.water;
    }
    // food energy + protein from everything eaten today
    const t = dayTotalsLocal(day);
    const dk = Math.round(t.kcal - (done.kcal || 0)), dp = Math.round(t.p - (done.p || 0));
    if (dk > 5 && can.has('dietaryEnergyConsumed')) {
      await Health.saveSample({ dataType: 'dietaryEnergyConsumed', value: dk, unit: 'kilocalorie', startDate: iso(earlier), endDate: iso(now) });
      next.kcal = Math.round(t.kcal);
    }
    if (dp > 1 && can.has('dietaryProtein')) {
      await Health.saveSample({ dataType: 'dietaryProtein', value: dp, unit: 'gram', startDate: iso(earlier), endDate: iso(now) });
      next.p = Math.round(t.p);
    }
    // in-app workouts → active calories (and breathing sessions → mindfulness)
    for (const w of day.workouts || []) {
      const key = w.time;
      if (next.workouts.includes(key)) continue;
      const st = new Date(w.time), en = new Date(st.getTime() + w.mins * 60000);
      const s = st < en ? st : earlier;
      if (can.has('calories')) await Health.saveSample({ dataType: 'calories', value: w.kcal, unit: 'kilocalorie', startDate: iso(s), endDate: iso(en > now ? now : en), metadata: { source: 'VegVital', title: w.title } });
      if ((w.id === 'sleep' || w.id === 'morning_yoga') && can.has('mindfulness')) {
        await Health.saveSample({ dataType: 'mindfulness', value: w.mins, unit: 'minute', startDate: iso(s), endDate: iso(en > now ? now : en), mindfulnessSessionType: w.id === 'sleep' ? 'breathing' : 'movement' });
      }
      next.workouts.push(key);
    }
    updateDay((d) => ({ ...d, hcWritten: next }));
  } catch { /* permission missing — reading still works */ }
  writing = false;
}

function dayTotalsLocal(day) {
  const items = [...Object.values(day.meals || {}).flatMap((m) => m.items || []), ...(day.extra || []).flatMap((e) => e.items)];
  return items.reduce((a, it) => { const q = it.qty ?? 1; a.kcal += (it.kcal || 0) * q; a.p += (it.p || 0) * q; return a; }, { kcal: 0, p: 0 });
}

export const watchName = () => getState().watch?.device || null;

// ---------- Phone pedometer fallback (while app open) ----------
let lastPeak = 0, above = false, motionHandle = null, buffered = 0;
export async function startPedometer() {
  if (motionHandle) return;
  try {
    const DM = window.DeviceMotionEvent;
    if (DM && typeof DM.requestPermission === 'function') await DM.requestPermission();
  } catch { /* ignore */ }
  try {
    motionHandle = await Motion.addListener('accel', (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      const t = performance.now();
      if (mag > 11.2 && !above && t - lastPeak > 280) { above = true; lastPeak = t; buffered++; }
      if (mag < 9.6) above = false;
    });
    setInterval(() => {
      if (!buffered) return;
      const n = buffered; buffered = 0;
      if (getState().healthConnected) return; // Health Connect is the source of truth
      updateDay((d) => ({ ...d, steps: (d.steps || 0) + n, stepsSource: 'Phone sensor' }));
    }, 4000);
  } catch { /* sensor not available */ }
}

// ---------- Auto sleep from overnight inactivity ----------
export function markActive() {
  setState({ lastActive: new Date().toISOString() });
}

export function inferSleepFromInactivity() {
  const { lastActive, profile } = getState();
  const today = getDay();
  if (!lastActive || today.sleep) return;
  const last = new Date(lastActive);
  const now = new Date();
  const gapH = (now - last) / 3600e3;
  const h = now.getHours();
  const lastH = last.getHours();
  const lastWasEvening = lastH >= 20 || lastH < 3;
  if (h >= 4 && h <= 13 && gapH >= 3 && gapH <= 14 && lastWasEvening) {
    // assume ~15 min to fall asleep after last phone use
    const st = new Date(last.getTime() + 15 * 60000);
    const mins = Math.round((now - st) / 60000);
    updateDay((d) => ({ ...d, sleep: { start: st.toISOString(), end: now.toISOString(), mins, source: 'Auto (phone inactivity)' } }));
  } else if (h >= 13 && !today.sleep && profile.bed && profile.wake) {
    // fall back to your usual schedule so the day is never empty
    let mins = toMin(profile.wake) - toMin(profile.bed);
    if (mins < 0) mins += 1440;
    const end = new Date(); const [wh, wm] = profile.wake.split(':').map(Number); end.setHours(wh, wm, 0, 0);
    const st = new Date(end.getTime() - mins * 60000);
    updateDay((d) => ({ ...d, sleep: { start: st.toISOString(), end: end.toISOString(), mins, source: 'Usual schedule' } }));
  }
}

// ---------- Auto-log planned meals ----------
export function autoLogPlannedMeals() {
  const { profile } = getState();
  if (!profile.autoPlan) return;
  const plan = planForDate();
  const n = nowMin();
  updateDay((d) => {
    const meals = { ...d.meals };
    let changed = false;
    for (const slot of MEAL_SLOTS) {
      if (meals[slot.key]) continue;
      if (n >= toMin(slot.end) + 30) {
        meals[slot.key] = { items: plan.meals[slot.key].items, source: 'plan-auto', time: new Date().toISOString() };
        changed = true;
      }
    }
    return changed ? { ...d, meals } : d;
  });
}

// ---------- Reminders ----------
export async function scheduleReminders() {
  if (!native) return;
  const { profile } = getState();
  try {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return;
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    if (!profile.reminders) return;
    const list = [];
    let id = 100;
    const at = (hhmm, title, body) => {
      const [hour, minute] = hhmm.split(':').map(Number);
      list.push({ id: id++, title, body, schedule: { on: { hour, minute }, allowWhileIdle: true }});
    };
    const plan = planForDate();
    MEAL_SLOTS.forEach((s) => {
      const names = plan.meals[s.key].items.map((i) => i.name).join(', ');
      at(s.time, `${s.icon} ${s.label} time`, `Plan: ${names}. Snap a photo if you eat something else.`);
    });
    // water every 90 min across the waking day
    for (let m = toMin(profile.wake) + 30; m < toMin(profile.bed) - 60; m += 90) {
      at(`${Math.floor(m / 60)}:${m % 60}`, '💧 Water break', 'One glass now keeps you on track for 2 L+.');
    }
    // desk break every 75 min during work
    for (let m = toMin(profile.workStart) + 60; m < toMin(profile.workEnd); m += 75) {
      at(`${Math.floor(m / 60)}:${m % 60}`, '🧍 Stand & stretch', '3-minute Desk Break Reset — your back will thank you.');
    }
    const wind = toMin(profile.bed) - 30;
    at(`${Math.floor(((wind + 1440) % 1440) / 60)}:${(wind + 1440) % 60}`, '🌙 Wind down', 'Screens off soon. Try the 5-min Wind-Down flow.');
    await LocalNotifications.schedule({ notifications: list });
  } catch { /* ignore */ }
}

// ---------- Boot ----------
export async function startAutomation() {
  inferSleepFromInactivity();
  autoLogPlannedMeals();
  markActive();
  startPedometer();
  syncHealth();
  scheduleReminders();
  setInterval(() => { autoLogPlannedMeals(); markActive(); writeBack(); }, 60000);
  setInterval(syncHealth, 3 * 60000);
  try {
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) { inferSleepFromInactivity(); autoLogPlannedMeals(); syncHealth(); }
      markActive();
    });
  } catch { /* web */ }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { inferSleepFromInactivity(); autoLogPlannedMeals(); }
    markActive();
  });
}

export { todayKey };
