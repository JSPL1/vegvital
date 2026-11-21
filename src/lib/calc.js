import { sumNutrition } from '../data/foods.js';
import { MEAL_SLOTS } from '../data/plan.js';

export function dayItems(day) {
  return [
    ...MEAL_SLOTS.flatMap((s) => day.meals?.[s.key]?.items || []),
    ...(day.extra || []).flatMap((e) => e.items),
  ];
}

export function dayTotals(day) {
  return sumNutrition(dayItems(day));
}

export function burned(day, kg = 70) {
  const workouts = (day.workouts || []).reduce((a, w) => a + w.kcal, 0);
  const stepKcal = (day.steps || 0) * 0.04 * (kg / 70);
  return Math.round(Math.max(day.activeKcal || 0, workouts + stepKcal));
}

export function proteinGoal(p) {
  return Math.round(p.weightKg * (p.goal === 'gain' ? 1.6 : 1.2));
}

/** 0-100 daily score blending food, water, steps, sleep, workout */
export function dayScore(day, p) {
  const t = dayTotals(day);
  const kcalScore = t.kcal ? Math.max(0, 1 - Math.abs(t.kcal - p.targetKcal) / p.targetKcal) : 0;
  const prot = Math.min(1, t.p / proteinGoal(p));
  const water = Math.min(1, (day.water || 0) / p.waterGoal);
  const steps = Math.min(1, (day.steps || 0) / p.stepGoal);
  const sleep = day.sleep ? Math.max(0, 1 - Math.abs(day.sleep.mins / 60 - p.sleepGoalH) / p.sleepGoalH) : 0;
  const move = Math.min(1, (day.workouts || []).reduce((a, w) => a + w.mins, 0) / 30);
  return Math.round((kcalScore * 20 + prot * 20 + water * 15 + steps * 15 + sleep * 15 + move * 15));
}

export const fmtH = (mins) => `${Math.floor(mins / 60)}h ${String(Math.round(mins % 60)).padStart(2, '0')}m`;
export const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
