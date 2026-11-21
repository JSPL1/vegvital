import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore, updateDay, todayKey, emptyDay } from '../lib/store.js';
import { PROGRAMS, EXERCISES, WEEK_SCHEDULE, programKcal, programMinutes, kcalFor } from '../data/workouts.js';
import Figure from '../components/Figure.jsx';
import { Card, stagger, rise, Ring, Button, Pill, CountUp, tap, Bar, Sheet } from '../components/ui.jsx';
import { Haptics, NotificationType } from '@capacitor/haptics';

const REST = 10;

export default function Move({ startId, clearStart }) {
  const profile = useStore((s) => s.profile);
  const day = useStore((s) => s.days[todayKey()]) || emptyDay();
  const [active, setActive] = useState(null);
  const [detail, setDetail] = useState(null);
  const [preview, setPreview] = useState('squat');
  useEffect(() => { if (startId) { setActive(PROGRAMS.find((p) => p.id === startId)); clearStart?.(); } }, [startId]);
  const todays = WEEK_SCHEDULE[new Date().getDay()];
  const doneIds = new Set(day.workouts.map((w) => w.id));
  const totalMins = day.workouts.reduce((a, w) => a + w.mins, 0);
  const totalKcal = day.workouts.reduce((a, w) => a + w.kcal, 0);

  useEffect(() => {
    const keys = ['squat', 'jumping_jack', 'pushup', 'lunge', 'surya', 'burpee', 'glute_bridge', 'tree'];
    let i = 0;
    const t = setInterval(() => { i = (i + 1) % keys.length; setPreview(keys[i]); }, 4500);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div className="screen" variants={stagger} initial="hidden" animate="show">
      <motion.header className="top" variants={rise}><h1 className="title">Move</h1><Pill color="#f5576c">🔥 {Math.round(totalKcal)} kcal</Pill></motion.header>

      <Card className="move-hero" glow="#f093fb">
        <div className="grow">
          <div className="tiny muted">TODAY’S ACTIVITY</div>
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
            <motion.div key={preview} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.35 }}>
              <Figure pose={EXERCISES[preview].pose} size={110} color="#f093fb" fast={EXERCISES[preview].fast} />
            </motion.div>
          </AnimatePresence>
          <div className="tiny muted center-text">{EXERCISES[preview].name}</div>
        </div>
      </Card>

      <motion.h3 variants={rise} className="section">Suggested for today</motion.h3>
      {PROGRAMS.filter((p) => todays.includes(p.id)).map((p) => <ProgramCard key={p.id} p={p} kg={profile.weightKg} done={doneIds.has(p.id)} onStart={() => setActive(p)} />)}
      <motion.h3 variants={rise} className="section">All programs</motion.h3>
      {PROGRAMS.filter((p) => !todays.includes(p.id)).map((p) => <ProgramCard key={p.id} p={p} kg={profile.weightKg} done={doneIds.has(p.id)} onStart={() => setActive(p)} />)}

      <motion.h3 variants={rise} className="section">Exercise library <span className="tiny muted">· tap to learn</span></motion.h3>
      <div className="ex-grid">
        {Object.entries(EXERCISES).map(([k, e], i) => (
          <Card key={k} className="ex" onClick={() => setDetail(k)}>
            <Figure pose={e.pose} size={92} fast={e.fast} showFloor={false} color={['#00f5a0', '#f093fb', '#4facfe', '#ffd166'][i % 4]} />
            <div className="tiny b center-text">{e.name}</div>
            <div className="tiny muted center-text">{e.muscles}</div>
          </Card>
        ))}
      </div>
      <div style={{ height: 110 }} />

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail ? EXERCISES[detail].name : ''}>
        {detail && <ExerciseDetail k={detail} kg={profile.weightKg} />}
      </Sheet>

      <AnimatePresence>{active && <Player p={active} kg={profile.weightKg} onClose={() => setActive(null)} />}</AnimatePresence>
    </motion.div>
  );
}

function ExerciseDetail({ k, kg }) {
  const e = EXERCISES[k];
  const [phase, setPhase] = useState('');
  return (
    <div className="col gap">
      <div className="stage small-stage">
        <Figure pose={e.pose} size={230} fast={e.fast} color="#00f5a0" onPhase={setPhase} />
        {phase && <AnimatePresence mode="wait"><motion.div key={phase} className="phase" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>{phase}</motion.div></AnimatePresence>}
      </div>
      <div className="row gap wrap">{e.muscles.split(' · ').map((m) => <Pill key={m} color="#4facfe">{m}</Pill>)}<Pill color="#f5576c">🔥 {kcalFor(k, 60, kg).toFixed(1)} kcal/min</Pill></div>
      <Steps how={e.how} />
      <div className="tip-line small">💡 {e.cue}</div>
    </div>
  );
}

function Steps({ how, active = -1 }) {
  return (
    <ol className="steps">
      {how.map((h, i) => (
        <motion.li key={h} className={i === active ? 'on' : ''} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
          <span className="num">{i + 1}</span><span>{h}</span>
        </motion.li>
      ))}
    </ol>
  );
}

function ProgramCard({ p, kg, done, onStart }) {
  const first = EXERCISES[p.steps[0][0]];
  return (
    <Card className="program" onClick={onStart} style={{ background: `linear-gradient(135deg, ${p.gradient[0]}2e, ${p.gradient[1]}18)` }} glow={p.gradient[1]}>
      <div className="prog-fig" style={{ background: `linear-gradient(135deg, ${p.gradient[0]}55, ${p.gradient[1]}33)` }}>
        <Figure pose={first.pose} size={62} showFloor={false} color="#ffffff" fast={first.fast} />
      </div>
      <div className="grow">
        <div className="b">{p.emoji} {p.title} {done && '✅'}</div>
        <div className="tiny muted">{p.when}</div>
        <div className="row gap tiny" style={{ marginTop: 4 }}>
          <span>⏱ {programMinutes(p)} min</span><span>🔥 {Math.round(programKcal(p, kg))} kcal</span><span>📶 {p.level}</span>
        </div>
      </div>
      <motion.div className="play" whileTap={{ scale: 0.85 }}>▶</motion.div>
    </Card>
  );
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function Player({ p, kg, onClose }) {
  const steps = p.steps;
  const [i, setI] = useState(0);
  const [mode, setMode] = useState('ready'); // ready | work | rest | done
  const [left, setLeft] = useState(5);
  const [paused, setPaused] = useState(false);
  const [phase, setPhase] = useState('');
  const [reps, setReps] = useState(0);
  const startedAt = useRef(Date.now());
  const ex = EXERCISES[steps[i][0]];
  const dur = mode === 'work' ? steps[i][1] : mode === 'rest' ? REST : 5;
  const next = steps[i + 1] ? EXERCISES[steps[i + 1][0]] : null;
  const showEx = mode === 'rest' && next ? next : ex;

  useEffect(() => {
    if (paused || mode === 'done') return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [paused, mode, i]);

  useEffect(() => {
    if (mode === 'done') return;
    if (left > 0) { if (left <= 3) beep(620); return; }
    beep(940);
    try { Haptics.notification({ type: NotificationType.Success }); } catch { /* web */ }
    advance();
  }, [left]);

  function advance() {
    if (mode === 'ready') { setMode('work'); setLeft(steps[0][1]); setReps(0); return; }
    if (mode === 'work') {
      if (i + 1 >= steps.length) return finish();
      setMode('rest'); setLeft(REST); return;
    }
    if (mode === 'rest') { setI(i + 1); setMode('work'); setLeft(steps[i + 1][1]); setReps(0); }
  }
  function back() {
    tap();
    if (i === 0) { setMode('work'); setLeft(steps[0][1]); return; }
    setI(i - 1); setMode('work'); setLeft(steps[i - 1][1]); setReps(0);
  }
  function finish() {
    setMode('done');
    const kcal = programKcal(p, kg);
    const mins = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    updateDay((d) => ({
      ...d,
      workouts: [...d.workouts, { id: p.id, title: p.title, kcal: Math.round(kcal), mins, time: new Date().toISOString() }],
      breaks: p.id === 'desk' ? (d.breaks || 0) + 1 : d.breaks,
    }));
  }

  const overallDone = steps.slice(0, i).reduce((a, s) => a + s[1], 0) + (mode === 'work' ? dur - left : mode === 'rest' ? steps[i][1] : 0);
  const overallTotal = steps.reduce((a, s) => a + s[1], 0);

  return (
    <motion.div className="player" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      style={{ background: `radial-gradient(120% 60% at 50% 0%, ${p.gradient[0]}40, transparent 65%), var(--bg)` }}>
      <div className="row-between">
        <button className="icon-btn" onClick={onClose}>✕</button>
        <div className="center col"><b>{p.title}</b><span className="tiny muted">{fmt(Math.max(0, overallTotal - overallDone))} left</span></div>
        <span className="pill" style={{ '--c': p.gradient[0] }}>{Math.min(i + 1, steps.length)}/{steps.length}</span>
      </div>
      <div className="seg-progress">
        {steps.map((s, k) => (
          <i key={k} style={{ flex: s[1] }}>
            <motion.b style={{ background: `linear-gradient(90deg, ${p.gradient[0]}, ${p.gradient[1]})` }}
              animate={{ width: k < i || (k === i && mode === 'rest') ? '100%' : k === i && mode === 'work' ? `${((dur - left) / dur) * 100}%` : '0%' }}
              transition={{ duration: 0.9, ease: 'linear' }} />
          </i>
        ))}
      </div>

      {mode === 'done' ? (
        <div className="center col grow gap">
          <Confetti />
          <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: [0, 1.25, 1], rotate: 0 }} className="trophy">🏆</motion.div>
          <h2>Workout complete!</h2>
          <div className="done-stats">
            <div><b>{Math.round(programKcal(p, kg))}</b><span className="tiny muted">kcal</span></div>
            <div><b>{programMinutes(p)}</b><span className="tiny muted">minutes</span></div>
            <div><b>{steps.length}</b><span className="tiny muted">exercises</span></div>
          </div>
          <p className="muted small">Saved to today automatically.</p>
          <Button onClick={onClose}>Done</Button>
        </div>
      ) : (
        <>
          <div className="stage" style={{ '--c1': p.gradient[0], '--c2': p.gradient[1] }}>
            <div className="stage-top">
              <span className={`mode-tag ${mode}`}>{mode === 'ready' ? 'GET READY' : mode === 'rest' ? 'REST · NEXT UP' : 'NOW'}</span>
              {mode === 'work' && <span className="reps">Reps <b>{reps}</b></span>}
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={`${i}-${mode === 'rest'}`} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: mode === 'rest' ? 0.75 : 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.3 }}>
                <Figure pose={showEx.pose} size={250} fast={showEx.fast} paused={paused} color={p.gradient[0]}
                  onPhase={mode === 'work' ? setPhase : undefined} onRep={mode === 'work' ? setReps : undefined} />
              </motion.div>
            </AnimatePresence>
            {mode === 'work' && phase && (
              <AnimatePresence mode="wait">
                <motion.div key={phase} className="phase" initial={{ opacity: 0, y: -10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.2 }}>{phase}</motion.div>
              </AnimatePresence>
            )}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={`${i}-${mode}`} className="ex-info" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="row-between">
                <div className="grow">
                  <h2 className="ex-name">{showEx.name}</h2>
                  <div className="row gap wrap">{showEx.muscles.split(' · ').map((m) => <span key={m} className="chip">{m}</span>)}</div>
                </div>
                <Ring size={84} stroke={8} value={dur - left} max={dur} colors={mode === 'rest' ? ['#74b9ff', '#a29bfe'] : p.gradient} id={`pl${i}${mode}`}>
                  <div className="big2">{left}</div><div className="tiny muted">{mode === 'rest' ? 'rest' : 'sec'}</div>
                </Ring>
              </div>
              <Steps how={showEx.how} />
            </motion.div>
          </AnimatePresence>

          <div className="controls">
            <motion.button whileTap={{ scale: 0.85 }} className="ctl" onClick={back}>⏮</motion.button>
            <motion.button whileTap={{ scale: 0.9 }} className="ctl main" style={{ background: `linear-gradient(135deg, ${p.gradient[0]}, ${p.gradient[1]})` }} onClick={() => { tap(); setPaused(!paused); }}>
              {paused ? '▶' : '❚❚'}
            </motion.button>
            {mode === 'rest'
              ? <motion.button whileTap={{ scale: 0.85 }} className="ctl" onClick={() => { tap(); setLeft((l) => l + 10); }}>+10</motion.button>
              : <motion.button whileTap={{ scale: 0.85 }} className="ctl" onClick={() => { tap(); setLeft(0); }}>⏭</motion.button>}
          </div>
          {mode === 'rest' && <button className="tiny muted link center-text" onClick={() => setLeft(0)}>Skip rest →</button>}
        </>
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
