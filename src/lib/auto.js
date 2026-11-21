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
const READ = ['steps', 'sleep', 'calories', 'heartRate', 'weight'];

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
    const r = await Health.requestAuthorization({ read: READ, write: [] });
    setState({ healthConnected: r.readAuthorized.includes('steps') });
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
}

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
  setInterval(() => { autoLogPlannedMeals(); markActive(); }, 60000);
  setInterval(syncHealth, 5 * 60000);
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
