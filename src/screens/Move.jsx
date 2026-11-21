import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore, updateDay, todayKey, emptyDay } from '../lib/store.js';
import { PROGRAMS, EXERCISES, WEEK_SCHEDULE, programKcal, programMinutes, kcalFor } from '../data/workouts.js';
import Figure from '../components/Figure.jsx';
import { Card, stagger, rise, Ring, Button, Pill, CountUp, tap, Bar } from '../components/ui.jsx';
import { Haptics, NotificationType } from '@capacitor/haptics';

export default function Move({ startId, clearStart }) {
  const profile = useStore((s) => s.profile);
  const day = useStore((s) => s.days[todayKey()]) || emptyDay();
  const [active, setActive] = useState(null);
  const [preview, setPreview] = useState('jumping_jack');
  useEffect(() => { if (startId) { setActive(PROGRAMS.find((p) => p.id === startId)); clearStart?.(); } }, [startId]);
  const todays = WEEK_SCHEDULE[new Date().getDay()];
  const doneIds = new Set(day.workouts.map((w) => w.id));
  const totalMins = day.workouts.reduce((a, w) => a + w.mins, 0);
  const totalKcal = day.workouts.reduce((a, w) => a + w.kcal, 0);

  useEffect(() => {
    const keys = Object.keys(EXERCISES);
    const t = setInterval(() => setPreview(keys[Math.floor(Math.random() * keys.length)]), 3500);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div className="screen" variants={stagger} initial="hidden" animate="show">
      <motion.header className="top" variants={rise}><h1 className="title">Move</h1><Pill color="#f5576c">🔥 {Math.round(totalKcal)} kcal</Pill></motion.header>

      <Card className="move-hero" glow="#f093fb">
        <div className="grow">
          <div className="tiny muted">TODAY</div>
          <div className="big2"><CountUp value={totalMins} /> <small>/ 30 min</small></div>
          <Bar value={totalMins} max={30} colors={['#f093fb', '#f5576c']} />
          <div className="row gap" style={{ marginTop: 10 }}>
            <div><div className="tiny muted">Steps</div><b><CountUp value={day.steps || 0} /></b></div>
            <div><div className="tiny muted">Desk breaks</div><b>{day.breaks || 0}</b></div>
            <div><div className="tiny muted">Sessions</div><b>{day.workouts.length}</b></div>
          </div>
        </div>
        <div className="preview-fig">
          <AnimatePresence mode="wait">
            <motion.div key={preview} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
              <Figure pose={EXERCISES[preview].pose} size={86} color="#f093fb" fast={EXERCISES[preview].fast} />
            </motion.div>
          </AnimatePresence>
          <div className="tiny muted center-text">{EXERCISES[preview].name}</div>
        </div>
      </Card>

      <motion.h3 variants={rise} className="section">Suggested for today</motion.h3>
      {PROGRAMS.filter((p) => todays.includes(p.id)).map((p) => <ProgramCard key={p.id} p={p} kg={profile.weightKg} done={doneIds.has(p.id)} onStart={() => setActive(p)} />)}
      <motion.h3 variants={rise} className="section">All programs</motion.h3>
      {PROGRAMS.filter((p) => !todays.includes(p.id)).map((p) => <ProgramCard key={p.id} p={p} kg={profile.weightKg} done={doneIds.has(p.id)} onStart={() => setActive(p)} />)}

      <motion.h3 variants={rise} className="section">Exercise library</motion.h3>
      <div className="ex-grid">
        {Object.entries(EXERCISES).map(([k, e], i) => (
          <Card key={k} className="ex">
            <Figure pose={e.pose} size={64} fast={e.fast} color={['#00f5a0', '#f093fb', '#4facfe', '#ffd166'][i % 4]} />
            <div className="tiny b center-text">{e.name}</div>
            <div className="tiny muted center-text">{Math.round(kcalFor(k, 60, profile.weightKg))} kcal/min</div>
          </Card>
        ))}
      </div>
      <div style={{ height: 110 }} />

      <AnimatePresence>{active && <Player p={active} kg={profile.weightKg} onClose={() => setActive(null)} />}</AnimatePresence>
    </motion.div>
  );
}

function ProgramCard({ p, kg, done, onStart }) {
  return (
    <Card className="program" onClick={onStart} style={{ background: `linear-gradient(135deg, ${p.gradient[0]}33, ${p.gradient[1]}22)` }} glow={p.gradient[1]}>
      <motion.div className="prog-emoji" style={{ background: `linear-gradient(135deg, ${p.gradient[0]}, ${p.gradient[1]})` }} whileHover={{ rotate: 10 }}>{p.emoji}</motion.div>
      <div className="grow">
        <div className="b">{p.title} {done && '✅'}</div>
        <div className="tiny muted">{p.when}</div>
        <div className="row gap tiny" style={{ marginTop: 4 }}>
          <span>⏱ {programMinutes(p)} min</span><span>🔥 {Math.round(programKcal(p, kg))} kcal</span><span>📶 {p.level}</span>
        </div>
      </div>
      <motion.div className="play" whileTap={{ scale: 0.85 }}>▶</motion.div>
    </Card>
  );
}

function Player({ p, kg, onClose }) {
  const [i, setI] = useState(-1); // -1 = get ready
  const [left, setLeft] = useState(5);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const startedAt = useRef(Date.now());
  const step = i >= 0 ? p.steps[i] : null;
  const ex = step ? EXERCISES[step[0]] : EXERCISES[p.steps[0][0]];
  const dur = step ? step[1] : 5;

  useEffect(() => {
    if (paused || done) return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [paused, done, i]);

  useEffect(() => {
    if (left > 0) { if (left <= 3) beep(600); return; }
    beep(900);
    try { Haptics.notification({ type: NotificationType.Success }); } catch { /* web */ }
    if (i + 1 >= p.steps.length) finish();
    else { setI(i + 1); setLeft(p.steps[i + 1][1]); }
  }, [left]);

  function finish() {
    setDone(true);
    const kcal = programKcal(p, kg);
    const mins = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    updateDay((d) => ({
      ...d,
      workouts: [...d.workouts, { id: p.id, title: p.title, kcal: Math.round(kcal), mins, time: new Date().toISOString() }],
      breaks: p.id === 'desk' ? (d.breaks || 0) + 1 : d.breaks,
    }));
  }
  const skip = () => { tap(); setLeft(0); };

  return (
    <motion.div className="player" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      style={{ background: `radial-gradient(circle at 50% 30%, ${p.gradient[0]}44, transparent 60%), var(--bg)` }}>
      <div className="row-between"><button className="icon-btn" onClick={onClose}>✕</button><b>{p.title}</b><span className="tiny muted">{Math.max(0, i + 1)}/{p.steps.length}</span></div>
      <div className="progress-dots">{p.steps.map((_, k) => <motion.i key={k} animate={{ background: k < i ? p.gradient[1] : k === i ? '#fff' : 'rgba(255,255,255,.15)', scale: k === i ? 1.3 : 1 }} />)}</div>

      {done ? (
        <div className="center col grow">
          <Confetti />
          <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} className="trophy">🏆</motion.div>
          <h2>Workout complete!</h2>
          <p className="muted">🔥 {Math.round(programKcal(p, kg))} kcal · ⏱ {programMinutes(p)} min — logged automatically</p>
          <Button onClick={onClose}>Done</Button>
        </div>
      ) : (
        <div className="center col grow">
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }} className="center col">
              <div className="tiny muted">{i < 0 ? 'GET READY' : 'NOW'}</div>
              <h2 className="ex-name">{ex.name}</h2>
              <Figure pose={ex.pose} size={170} fast={ex.fast} paused={paused} color={p.gradient[0]} />
              <p className="small muted center-text">{ex.cue}</p>
            </motion.div>
          </AnimatePresence>
          <Ring size={130} stroke={10} value={dur - left} max={dur} colors={p.gradient} id={`pl${i}`}>
            <div className="big">{left}</div><div className="tiny muted">sec</div>
          </Ring>
          {step && i + 1 < p.steps.length && <div className="tiny muted">Next: {EXERCISES[p.steps[i + 1][0]].name}</div>}
          <div className="row gap">
            <Button variant="ghost" onClick={() => setPaused(!paused)}>{paused ? '▶ Resume' : '⏸ Pause'}</Button>
            <Button variant="ghost" onClick={skip}>⏭ Skip</Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

let ac;
function beep(freq) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(); const g = ac.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.08, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.15);
    o.start(); o.stop(ac.currentTime + 0.16);
  } catch { /* ignore */ }
}

export function Confetti({ n = 40 }) {
  const colors = ['#00f5a0', '#00d9f5', '#f093fb', '#ffd166', '#ff6b6b', '#a29bfe'];
  return (
    <div className="confetti">
      {[...Array(n)].map((_, k) => (
        <motion.i key={k} style={{ background: colors[k % colors.length], left: `${Math.random() * 100}%` }}
          initial={{ y: -20, rotate: 0, opacity: 1 }}
          animate={{ y: 700, rotate: 360 * (Math.random() > 0.5 ? 2 : -2), x: (Math.random() - 0.5) * 120, opacity: [1, 1, 0] }}
          transition={{ duration: 2 + Math.random() * 1.5, delay: Math.random() * 0.4, ease: 'easeIn' }} />
      ))}
    </div>
  );
}
