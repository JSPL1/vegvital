import { useSyncExternalStore } from 'react';
import { Preferences } from '@capacitor/preferences';

const KEY = 'vegvital-state-v1';

export const todayKey = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

const DEFAULT = {
  onboarded: false,
  profile: {
    name: '',
    age: 30,
    sex: 'male',
    heightCm: 170,
    weightKg: 72,
    goal: 'lose', // lose | maintain | gain
    targetKcal: 1650,
    waterGoal: 10, // glasses of 250 ml
    stepGoal: 8000,
    sleepGoalH: 8,
    wake: '07:30',
    bed: '23:00',
    workStart: '10:00',
    workEnd: '19:00',
    autoPlan: true, // auto-log planned meal when its time window passes
    reminders: true,
    apiKey: '',
    diet: 'veg', // veg today, 'nonveg' in a future version
  },
  days: {},
  weights: [], // {date, kg}
  lastActive: null,
};

let state = structuredClone(DEFAULT);
const listeners = new Set();
let saveTimer;

function emit() {
  listeners.forEach((l) => l());
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 250);
}

async function persist() {
  const json = JSON.stringify(state);
  try { await Preferences.set({ key: KEY, value: json }); } catch { /* web fallback below */ }
  try { localStorage.setItem(KEY, json); } catch { /* ignore */ }
}

export async function loadState() {
  let raw = null;
  try { raw = (await Preferences.get({ key: KEY })).value; } catch { /* ignore */ }
  if (!raw) { try { raw = localStorage.getItem(KEY); } catch { /* ignore */ } }
  if (raw) {
    try {
      const s = JSON.parse(raw);
      state = { ...DEFAULT, ...s, profile: { ...DEFAULT.profile, ...s.profile } };
    } catch { /* corrupted — start fresh */ }
  }
  emit();
}

export const getState = () => state;

export function setState(updater) {
  const next = typeof updater === 'function' ? updater(state) : updater;
  state = { ...state, ...next };
  emit();
}

export function useStore(selector = (s) => s) {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => selector(state),
  );
}

export function emptyDay() {
  return { meals: {}, extra: [], water: 0, steps: 0, stepsSource: null, sleep: null, workouts: [], breaks: 0, activeKcal: 0 };
}

export function getDay(key = todayKey()) {
  return state.days[key] || emptyDay();
}

export function updateDay(fn, key = todayKey()) {
  const day = { ...emptyDay(), ...(state.days[key] || {}) };
  const next = fn(day) || day;
  state = { ...state, days: { ...state.days, [key]: next } };
  emit();
}

export function updateProfile(patch) {
  state = { ...state, profile: { ...state.profile, ...patch } };
  emit();
}

/** Mifflin-St Jeor BMR + activity, minus deficit for goal. */
export function suggestedKcal(p) {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const tdee = bmr * 1.4;
  const adj = p.goal === 'lose' ? -450 : p.goal === 'gain' ? 300 : 0;
  return Math.round((tdee + adj) / 50) * 50;
}

export function bmi(p) {
  const m = p.heightCm / 100;
  return p.weightKg / (m * m);
}

export function lastNDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({ date: d, key: todayKey(d) });
  }
  return out;
}
