import { motion } from 'framer-motion';
import { useStore, lastNDays, emptyDay, bmi } from '../lib/store.js';
import { dayTotals, dayScore, proteinGoal, fmtH } from '../lib/calc.js';
import { Card, stagger, rise, CountUp, Ring, Pill } from '../components/ui.jsx';

function Bars({ data, goal, colors, unit = '', fmt = (v) => Math.round(v) }) {
  const max = Math.max(goal || 0, ...data.map((d) => d.v), 1) * 1.1;
  return (
    <div className="bars">
      {goal ? <div className="goal-line" style={{ bottom: `${(goal / max) * 100}%` }} /> : null}
      {data.map((d, i) => (
        <div className="bar-col" key={i}>
          <div className="bar-track">
            <motion.div className="bar-v" style={{ background: `linear-gradient(180deg, ${colors[0]}, ${colors[1]})` }}
              initial={{ height: 0 }} animate={{ height: `${(d.v / max) * 100}%` }} transition={{ delay: i * 0.07, type: 'spring', stiffness: 120, damping: 16 }} />
          </div>
          <span className="tiny muted">{d.l}</span>
        </div>
      ))}
    </div>
  );
}

export default function Insights() {
  const { days, profile, weights } = useStore();
  const week = lastNDays(7).map(({ date, key }) => ({ date, key, d: days[key] || emptyDay() }));
  const lbl = (date) => date.toLocaleDateString(undefined, { weekday: 'narrow' });
  const kcal = week.map((w) => ({ l: lbl(w.date), v: dayTotals(w.d).kcal }));
  const prot = week.map((w) => ({ l: lbl(w.date), v: dayTotals(w.d).p }));
  const steps = week.map((w) => ({ l: lbl(w.date), v: w.d.steps || 0 }));
  const sleep = week.map((w) => ({ l: lbl(w.date), v: (w.d.sleep?.mins || 0) / 60 }));
  const water = week.map((w) => ({ l: lbl(w.date), v: w.d.water || 0 }));
  const scores = week.map((w) => dayScore(w.d, profile));
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / 7);
  const logged = week.filter((w) => Object.keys(w.d.meals).length > 0).length;

  let streak = 0;
  const back = lastNDays(60).map((x) => x.key).reverse(); // today first
  for (let j = 0; j < back.length; j++) {
    const d = days[back[j]];
    if (d && dayScore(d, profile) >= 50) streak++;
    else if (j === 0) continue; // today not finished yet
    else break;
  }

  const avgSleep = sleep.filter((s) => s.v).reduce((a, s, _, arr) => a + s.v / arr.length, 0);
  const photos = Object.values(days).flatMap((d) => Object.values(d.meals || {})).filter((m) => m.source === 'photo').length;
  const workoutsTotal = Object.values(days).reduce((a, d) => a + (d.workouts?.length || 0), 0);
  const b = bmi(profile);
  const badges = [
    ['🔥', 'Streak 3', streak >= 3], ['🌱', 'Veg pro', logged >= 5], ['📸', 'Snapper', photos >= 5],
    ['💪', '10 workouts', workoutsTotal >= 10], ['💧', 'Hydrated', water.filter((w) => w.v >= profile.waterGoal).length >= 3], ['😴', 'Sleep king', avgSleep >= 7],
  ];

  return (
    <motion.div className="screen" variants={stagger} initial="hidden" animate="show">
      <motion.header className="top" variants={rise}><h1 className="title">Insights</h1><Pill color="#ffd166">🔥 {streak} day streak</Pill></motion.header>

      <Card className="hero insights-hero" glow="#f6d365">
        <Ring size={130} stroke={12} value={avgScore} max={100} colors={['#f6d365', '#fda085']} id="avg">
          <div className="big"><CountUp value={avgScore} /></div><div className="tiny muted">weekly score</div>
        </Ring>
        <div className="col gap-s">
          <div className="small">⚖️ {profile.weightKg} kg · BMI <b>{b.toFixed(1)}</b></div>
          <div className="small">😴 Avg sleep <b>{fmtH(avgSleep * 60)}</b></div>
          <div className="small">🍽️ Days logged <b>{logged}/7</b></div>
          <div className="small">📸 Photo meals <b>{photos}</b></div>
        </div>
      </Card>

      <Card><div className="row-between"><h3>Calories</h3><span className="tiny muted">target {profile.targetKcal}</span></div><Bars data={kcal} goal={profile.targetKcal} colors={['#00f5a0', '#00d9f5']} /></Card>
      <Card><div className="row-between"><h3>Protein</h3><span className="tiny muted">goal {proteinGoal(profile)} g</span></div><Bars data={prot} goal={proteinGoal(profile)} colors={['#ff6b9d', '#c44569']} unit="g" /></Card>
      <div className="grid2">
        <Card><h3>Steps</h3><Bars data={steps} goal={profile.stepGoal} colors={['#f093fb', '#f5576c']} fmt={(v) => `${Math.round(v / 1000)}k`} /></Card>
        <Card><h3>Sleep</h3><Bars data={sleep} goal={profile.sleepGoalH} colors={['#667eea', '#764ba2']} unit="h" fmt={(v) => v.toFixed(0)} /></Card>
      </div>
      <Card><h3>Water (glasses)</h3><Bars data={water} goal={profile.waterGoal} colors={['#4facfe', '#00f2fe']} /></Card>

      {weights.length > 1 && (
        <Card><h3>Weight trend</h3>
          <div className="row gap wrap">{weights.slice(-8).map((w) => <span key={w.date} className="chip">{w.date.slice(5)} · {w.kg.toFixed(1)}</span>)}</div>
        </Card>
      )}

      <Card>
        <h3>Badges</h3>
        <div className="badges">
          {badges.map(([e, l, ok], i) => (
            <motion.div key={l} className={`badge ${ok ? 'ok' : ''}`} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.1 * i, type: 'spring' }}>
              <motion.span animate={ok ? { y: [0, -4, 0] } : {}} transition={{ repeat: Infinity, duration: 2, delay: i * 0.2 }}>{e}</motion.span>
              <span className="tiny">{l}</span>
            </motion.div>
          ))}
        </div>
      </Card>
      <div style={{ height: 110 }} />
    </motion.div>
  );
}
