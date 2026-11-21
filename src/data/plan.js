// 7-day rotating ~1650 kcal plan, based on your nutritionist's plan (Sep 2026),
// converted to 100% vegetarian: every egg / chicken dish swapped for a
// protein-matched veg dish (paneer, tofu, soya, besan, dal).
import { FOOD_BY_ID, sumNutrition } from './foods.js';

export const MEAL_SLOTS = [
  { key: 'pre', label: 'Pre-Breakfast', time: '08:30', end: '09:00', icon: '🌅', color: '#ffd166' },
  { key: 'breakfast', label: 'Breakfast', time: '11:00', end: '11:30', icon: '🍳', color: '#ff9f43' },
  { key: 'msnack', label: 'Morning Snack', time: '13:00', end: '13:30', icon: '🍎', color: '#7bed9f' },
  { key: 'lunch', label: 'Lunch', time: '14:30', end: '15:00', icon: '🍱', color: '#4cd3c2' },
  { key: 'esnack', label: 'Evening Snack', time: '17:30', end: '18:00', icon: '🥨', color: '#a29bfe' },
  { key: 'dinner', label: 'Dinner', time: '20:30', end: '21:00', icon: '🍲', color: '#fd79a8' },
  { key: 'post', label: 'Post-Dinner', time: '22:00', end: '22:30', icon: '🌙', color: '#74b9ff' },
];

const PRE = [['almond_soaked', 1], ['walnut_soaked', 1], ['jeera_water', 1]];
const POST = [['haldi_doodh', 1]];
const FRUIT = [['fruit_seasonal', 1]];
const EVE = [['makhana', 1], ['buttermilk', 1]];

// index 0 = Sunday ... 6 = Saturday
export const WEEK_PLAN = [
  { // Day A
    swaps: [],
    breakfast: [['curd_200', 1], ['moong_chilla', 1]],
    lunch: [['salad', 1], ['roti_dal_veg', 1], ['curd', 1]],
    dinner: [['salad', 1], ['rajma', 1], ['roti_40', 1]],
    swapNote: 'Chicken curry → Rajma (same protein, more fibre)',
  },
  { // Day B
    breakfast: [['greek_yogurt', 1], ['paneer_chilla', 1], ['bread_toast', 1]],
    lunch: [['lentil_pulao', 1], ['salad', 1], ['mint_raita', 1]],
    dinner: [['roti_80', 1], ['soya_aloo', 1], ['salad', 1]],
    swapNote: 'Egg-white omelette → Paneer besan chilla',
  },
  { // Day C
    breakfast: [['tofu_bhurji', 1], ['idli_sambar', 1]],
    lunch: [['paneer_bhurji', 1], ['roti_80', 1], ['salad', 1]],
    dinner: [['roti_40', 1], ['kala_chana_kadhi', 1], ['curd', 1], ['salad', 1]],
    swapNote: 'Egg bhurji → Tofu bhurji',
  },
  { // Day D
    breakfast: [['poha', 1], ['paneer_30', 1]],
    lunch: [['roti_80', 1], ['palak_bhurji', 1], ['salad', 1], ['curd', 1]],
    dinner: [['ragi_roti', 1], ['masoor_dal', 1], ['salad', 1]],
  },
  { // Day E
    breakfast: [['moong_chilla', 1], ['curd_200', 1]],
    lunch: [['soya_chunks_curry', 1], ['roti_80', 1], ['salad', 1], ['curd', 1]],
    dinner: [['roti_40', 1], ['methi_paneer', 1], ['salad', 1]],
    swapNote: 'Egg curry → Soya chunks curry · Methi chicken → Methi paneer',
  },
  { // Day F
    breakfast: [['upma', 1], ['greek_yogurt', 1]],
    lunch: [['mint_raita', 1], ['pea_pulao', 1], ['salad', 1]],
    dinner: [['roti_80', 1], ['soya_aloo', 1], ['salad', 1]],
  },
  { // Day G
    breakfast: [['paneer_roll', 1]],
    lunch: [['roti_80', 1], ['dahi_bhindi', 1], ['salad', 1], ['curd', 1]],
    dinner: [['khichdi', 1], ['curd', 1], ['salad', 1]],
    swapNote: 'Egg roll → Paneer kathi roll',
  },
];

export function planForDate(date = new Date()) {
  const d = WEEK_PLAN[date.getDay()];
  const raw = {
    pre: PRE,
    breakfast: d.breakfast,
    msnack: FRUIT,
    lunch: d.lunch,
    esnack: EVE,
    dinner: d.dinner,
    post: POST,
  };
  const meals = {};
  for (const slot of MEAL_SLOTS) {
    const items = raw[slot.key].map(([id, qty]) => ({ ...FOOD_BY_ID[id], qty }));
    meals[slot.key] = { ...slot, items, total: sumNutrition(items) };
  }
  const total = sumNutrition(Object.values(meals).flatMap((m) => m.items));
  return { meals, total, swapNote: d.swapNote };
}

export const DAILY_RULES = [
  { icon: '💧', text: 'Drink 8–10 glasses (min 2 L) of water' },
  { icon: '🚫', text: 'No packaged juices, soft drinks or sweetened beverages' },
  { icon: '🥄', text: 'Measure oil with a teaspoon — prefer baked, roasted, steamed' },
  { icon: '🌶️', text: 'Spices are free — use them generously' },
  { icon: '⏰', text: 'Eat at regular intervals — never skip a scheduled meal' },
  { icon: '🍬', text: 'Small dessert occasionally is fine' },
  { icon: '🚶', text: '150 min moderate activity / week + strength 2×/week' },
  { icon: '😴', text: '7–9 hours sleep, consistent timings, less screen before bed' },
  { icon: '🧘', text: 'Breathing, yoga or meditation for stress' },
];
