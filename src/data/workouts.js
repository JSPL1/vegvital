// Exercise library. `met` = metabolic equivalent → kcal = met * 3.5 * kg / 200 * minutes
// `pose` names map to animated figure poses in components/Figure.jsx
export const EXERCISES = {
  march: { name: 'Marching in place', pose: 'march', met: 3.5, muscles: 'Legs · Heart', cue: 'Lift knees to hip height, swing arms.', how: ['Stand tall, core tight', 'Lift one knee to hip height', 'Swing the opposite arm, switch legs'] },
  jumping_jack: { name: 'Jumping jacks', pose: 'jack', met: 8, muscles: 'Full body · Cardio', cue: 'Land softly, arms fully overhead.', how: ['Feet together, arms by sides', 'Jump feet wide, arms overhead', 'Jump back in — land softly'] },
  squat: { name: 'Bodyweight squats', pose: 'squat', met: 5, muscles: 'Thighs · Glutes', cue: 'Hips back, chest up, knees over toes.', how: ['Feet shoulder-width apart', 'Sit hips back and down, arms forward', 'Push through heels to stand'] },
  pushup: { name: 'Push-ups (knees ok)', pose: 'pushup', met: 8, muscles: 'Chest · Arms · Core', cue: 'Body straight, lower chest to floor.', how: ['Hands under shoulders, body straight', 'Bend elbows back, chest to floor', 'Push the floor away'] },
  lunge: { name: 'Alternating lunges', pose: 'lunge', met: 6, muscles: 'Thighs · Glutes · Balance', cue: 'Back knee hovers just above floor.', how: ['Stand tall, hands relaxed', 'Big step, drop back knee down', 'Push back up, switch legs'] },
  plank: { name: 'Plank hold', pose: 'plank', met: 4, muscles: 'Core · Shoulders', cue: 'Squeeze glutes, don’t let hips sag.', how: ['Elbows under shoulders', 'Body in one straight line', 'Squeeze belly & glutes, breathe'] },
  high_knees: { name: 'High knees', pose: 'march', met: 8, muscles: 'Legs · Cardio', cue: 'Fast pace, drive knees up.', fast: true, how: ['Run on the spot', 'Drive knees up to hip height', 'Stay light on your toes'] },
  arm_circles: { name: 'Arm circles', pose: 'armcircle', met: 3, muscles: 'Shoulders', cue: 'Small to big circles, both directions.', how: ['Arms straight out to the sides', 'Draw small circles', 'Reverse direction halfway'] },
  side_bend: { name: 'Standing side bends', pose: 'sidebend', met: 2.5, muscles: 'Waist · Back', cue: 'Reach long over your head.', how: ['Feet hip-width apart', 'Reach one arm up and over', 'Slowly switch sides'] },
  twist: { name: 'Standing twists', pose: 'twist', met: 3, muscles: 'Waist · Spine', cue: 'Rotate from the waist, hips still.', how: ['Elbows up, hands near chest', 'Turn upper body to one side', 'Keep hips facing forward'] },
  neck_roll: { name: 'Neck & shoulder rolls', pose: 'neck', met: 1.5, muscles: 'Neck · Upper back', cue: 'Slow circles, release tension.', how: ['Sit or stand tall', 'Ear gently toward each shoulder', 'Roll shoulders back slowly'] },
  chair_squat: { name: 'Chair sit-to-stand', pose: 'squat', met: 4, muscles: 'Thighs · Glutes', cue: 'Tap the chair, stand tall.', how: ['Stand in front of your chair', 'Sit back until you tap the seat', 'Stand up without using hands'] },
  desk_pushup: { name: 'Desk push-ups', pose: 'deskpush', met: 4, muscles: 'Chest · Arms', cue: 'Hands on desk edge, body straight.', how: ['Hands on a sturdy desk edge', 'Lower chest toward the desk', 'Push back to straight arms'] },
  calf_raise: { name: 'Calf raises', pose: 'calf', met: 3, muscles: 'Calves · Ankles', cue: 'Rise onto toes, lower slowly.', how: ['Stand tall, hold a wall if needed', 'Rise up onto your toes', 'Lower heels slowly'] },
  surya: { name: 'Surya namaskar', pose: 'surya', met: 4, muscles: 'Full body · Flexibility', cue: 'Flow with breath, one move per breath.', how: ['Follow each pose shown', 'Inhale on upward moves', 'Exhale on folding moves'] },
  cobra: { name: 'Bhujangasana (cobra)', pose: 'cobra', met: 2.5, muscles: 'Lower back · Chest', cue: 'Lift chest, elbows soft.', how: ['Lie face down, hands by chest', 'Press up, lift chest gently', 'Shoulders away from ears'] },
  child: { name: 'Balasana (child pose)', pose: 'child', met: 1.5, muscles: 'Back · Hips', cue: 'Forehead down, breathe into back.', how: ['Kneel, sit hips on heels', 'Fold forward, arms long', 'Relax and breathe slowly'] },
  tree: { name: 'Vrikshasana (tree)', pose: 'tree', met: 2.5, muscles: 'Balance · Legs', cue: 'Fix gaze on one point.', how: ['Stand on one leg', 'Foot on inner thigh or calf', 'Palms together overhead'] },
  breath: { name: 'Box breathing 4-4-4-4', pose: 'breathe', met: 1.2, muscles: 'Calm · Focus', cue: 'In 4 · hold 4 · out 4 · hold 4.', how: ['Breathe in for 4 counts', 'Hold for 4, out for 4', 'Hold for 4, repeat'] },
  anulom: { name: 'Anulom vilom', pose: 'breathe', met: 1.2, muscles: 'Calm · Lungs', cue: 'Alternate nostrils, slow and even.', how: ['Sit tall, close right nostril', 'Inhale left, switch, exhale right', 'Inhale right, switch, exhale left'] },
  burpee: { name: 'Burpees', pose: 'burpee', met: 10, muscles: 'Full body · Cardio', cue: 'Squat, jump back, jump up.', how: ['Squat, hands to floor', 'Jump feet back to plank', 'Jump feet in, then jump up'] },
  mountain: { name: 'Mountain climbers', pose: 'climber', met: 8, muscles: 'Core · Cardio', cue: 'Drive knees to chest, fast.', fast: true, how: ['Start in a high plank', 'Drive one knee to chest', 'Switch legs quickly'] },
  glute_bridge: { name: 'Glute bridge', pose: 'bridge', met: 3.5, muscles: 'Glutes · Lower back', cue: 'Squeeze glutes at the top.', how: ['Lie on back, knees bent', 'Push through heels, lift hips', 'Squeeze glutes, lower slowly'] },
  walk: { name: 'Brisk walk', pose: 'walk', met: 4.3, muscles: 'Heart · Legs · Digestion', cue: '5–6 km/h, arms swinging.', how: ['Walk at a brisk pace', 'Swing arms naturally', 'Breathe through your nose'] },
  hamstring: { name: 'Hamstring stretch', pose: 'forward', met: 2, muscles: 'Back of legs', cue: 'Hinge at hips, soft knees.', how: ['Feet hip-width, knees soft', 'Hinge forward from the hips', 'Let arms hang, breathe'] },
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
