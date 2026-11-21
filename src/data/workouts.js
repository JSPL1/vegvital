// Exercise library. `met` = metabolic equivalent → kcal = met * 3.5 * kg / 200 * minutes
// `pose` names map to animated figure poses in components/Figure.jsx
export const EXERCISES = {
  march: { name: 'Marching in place', pose: 'march', met: 3.5, cue: 'Lift knees to hip height, swing arms.' },
  jumping_jack: { name: 'Jumping jacks', pose: 'jack', met: 8, cue: 'Land softly, arms fully overhead.' },
  squat: { name: 'Bodyweight squats', pose: 'squat', met: 5, cue: 'Hips back, chest up, knees over toes.' },
  pushup: { name: 'Push-ups (knees ok)', pose: 'pushup', met: 8, cue: 'Body straight, lower chest to floor.' },
  lunge: { name: 'Alternating lunges', pose: 'lunge', met: 6, cue: 'Back knee hovers just above floor.' },
  plank: { name: 'Plank hold', pose: 'plank', met: 4, cue: 'Squeeze glutes, don’t let hips sag.' },
  high_knees: { name: 'High knees', pose: 'march', met: 8, cue: 'Fast pace, drive knees up.', fast: true },
  arm_circles: { name: 'Arm circles', pose: 'armcircle', met: 3, cue: 'Small to big circles, both directions.' },
  side_bend: { name: 'Standing side bends', pose: 'sidebend', met: 2.5, cue: 'Reach long over your head.' },
  twist: { name: 'Standing twists', pose: 'twist', met: 3, cue: 'Rotate from the waist, hips still.' },
  neck_roll: { name: 'Neck & shoulder rolls', pose: 'neck', met: 1.5, cue: 'Slow circles, release tension.' },
  chair_squat: { name: 'Chair sit-to-stand', pose: 'squat', met: 4, cue: 'Tap the chair, stand tall.' },
  desk_pushup: { name: 'Desk push-ups', pose: 'pushup', met: 4, cue: 'Hands on desk edge, body straight.' },
  calf_raise: { name: 'Calf raises', pose: 'calf', met: 3, cue: 'Rise onto toes, lower slowly.' },
  surya: { name: 'Surya namaskar', pose: 'surya', met: 4, cue: 'Flow with breath, 12 steps per round.' },
  cobra: { name: 'Bhujangasana (cobra)', pose: 'cobra', met: 2.5, cue: 'Lift chest, elbows soft.' },
  child: { name: 'Balasana (child pose)', pose: 'child', met: 1.5, cue: 'Forehead down, breathe into back.' },
  tree: { name: 'Vrikshasana (tree)', pose: 'tree', met: 2.5, cue: 'Fix gaze on one point.' },
  breath: { name: 'Box breathing 4-4-4-4', pose: 'breathe', met: 1.2, cue: 'In 4 · hold 4 · out 4 · hold 4.' },
  anulom: { name: 'Anulom vilom', pose: 'breathe', met: 1.2, cue: 'Alternate nostrils, slow and even.' },
  burpee: { name: 'Burpees', pose: 'burpee', met: 10, cue: 'Squat, jump back, jump up.' },
  mountain: { name: 'Mountain climbers', pose: 'plank', met: 8, cue: 'Drive knees to chest, fast.', fast: true },
  glute_bridge: { name: 'Glute bridge', pose: 'bridge', met: 3.5, cue: 'Squeeze glutes at the top.' },
  walk: { name: 'Brisk walk', pose: 'march', met: 4.3, cue: '5–6 km/h, arms swinging.' },
  hamstring: { name: 'Hamstring stretch', pose: 'forward', met: 2, cue: 'Hinge at hips, soft knees.' },
};

// [exerciseKey, seconds]
export const PROGRAMS = [
  {
    id: 'morning_yoga', title: 'Morning Yoga Flow', emoji: '🧘', level: 'Easy', when: 'Before breakfast',
    gradient: ['#f6d365', '#fda085'],
    steps: [['breath', 60], ['neck_roll', 45], ['surya', 120], ['cobra', 45], ['child', 45], ['tree', 60], ['anulom', 90]],
  },
  {
    id: 'desk', title: 'Desk Break Reset', emoji: '💻', level: 'Easy', when: 'Every 60–90 min at work',
    gradient: ['#84fab0', '#8fd3f4'],
    steps: [['neck_roll', 40], ['arm_circles', 40], ['twist', 40], ['chair_squat', 45], ['desk_pushup', 40], ['calf_raise', 40], ['side_bend', 40]],
  },
  {
    id: 'strength', title: 'Home Strength', emoji: '💪', level: 'Medium', when: '2–3× / week',
    gradient: ['#a18cd1', '#fbc2eb'],
    steps: [['march', 60], ['squat', 45], ['pushup', 40], ['lunge', 45], ['glute_bridge', 45], ['plank', 40], ['squat', 45], ['pushup', 40], ['plank', 40], ['hamstring', 60]],
  },
  {
    id: 'hiit', title: 'Fat-Burn HIIT', emoji: '🔥', level: 'Hard', when: 'Evening, before snack',
    gradient: ['#ff512f', '#f09819'],
    steps: [['march', 60], ['jumping_jack', 40], ['high_knees', 30], ['burpee', 30], ['mountain', 30], ['squat', 40], ['jumping_jack', 40], ['burpee', 30], ['mountain', 30], ['child', 60]],
  },
  {
    id: 'walk', title: 'Post-Meal Walk', emoji: '🚶', level: 'Easy', when: '10–15 min after lunch & dinner',
    gradient: ['#43e97b', '#38f9d7'],
    steps: [['walk', 600]],
  },
  {
    id: 'sleep', title: 'Wind-Down for Sleep', emoji: '🌙', level: 'Easy', when: '22:30, screens off',
    gradient: ['#667eea', '#764ba2'],
    steps: [['neck_roll', 45], ['hamstring', 60], ['child', 60], ['breath', 120], ['anulom', 120]],
  },
];

export function kcalFor(exKey, seconds, kg = 70) {
  const ex = EXERCISES[exKey];
  return (ex.met * 3.5 * kg) / 200 * (seconds / 60);
}

export function programKcal(p, kg) {
  return p.steps.reduce((a, [k, s]) => a + kcalFor(k, s, kg), 0);
}
export function programMinutes(p) {
  return Math.round(p.steps.reduce((a, [, s]) => a + s, 0) / 60);
}

// Weekly schedule suggestion (0 = Sunday)
export const WEEK_SCHEDULE = [
  ['morning_yoga', 'walk'],
  ['morning_yoga', 'strength', 'walk'],
  ['morning_yoga', 'hiit', 'walk'],
  ['morning_yoga', 'strength', 'walk'],
  ['morning_yoga', 'walk'],
  ['morning_yoga', 'strength', 'walk'],
  ['morning_yoga', 'hiit', 'walk'],
];
