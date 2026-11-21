import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore, updateProfile, suggestedKcal, bmi, setState, getState } from '../lib/store.js';
import { connectHealth, scheduleReminders, healthAvailable } from '../lib/auto.js';
import { testKey } from '../lib/ai.js';
import { Card, stagger, rise, Button, Pill, tap } from '../components/ui.jsx';

function Field({ label, children }) {
  return <label className="field"><span className="tiny muted">{label}</span>{children}</label>;
}

export default function Settings({ back, toast }) {
  const p = useStore((s) => s.profile);
  const connected = useStore((s) => s.healthConnected);
  const [key, setKey] = useState(p.apiKey);
  const [testing, setTesting] = useState(false);
  const num = (k) => (e) => updateProfile({ [k]: Number(e.target.value) });
  const str = (k) => (e) => updateProfile({ [k]: e.target.value });

  async function saveKey() {
    setTesting(true);
    try { await testKey(key.trim()); updateProfile({ apiKey: key.trim() }); toast('✅ AI key works — photo scanning is ready'); }
    catch (e) { toast('❌ Key rejected: ' + String(e?.message || e).slice(0, 80)); }
    setTesting(false);
  }

  async function health() {
    const r = await connectHealth();
    toast(r.ok ? '✅ Health Connect linked — steps & sleep now automatic' : `⚠️ ${r.reason || 'Permission not granted'}`);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'vegvital-backup.json'; a.click();
  }

  return (
    <motion.div className="screen" variants={stagger} initial="hidden" animate="show">
      <motion.header className="top" variants={rise}>
        <button className="icon-btn" onClick={back}>←</button>
        <h1 className="title">Settings</h1>
        <span />
      </motion.header>

      <Card>
        <h3>🤖 AI food scanner</h3>
        <p className="small muted">Paste your Anthropic API key once (console.anthropic.com → API keys). It stays only on this phone and is used to read your food photos.</p>
        <div className="row gap">
          <input className="input grow" type="password" placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} />
          <Button onClick={saveKey} disabled={testing || !key}>{testing ? '…' : 'Save'}</Button>
        </div>
        {p.apiKey && <div className="tiny ok-text">● Connected</div>}
      </Card>

      <Card>
        <h3>⌚ Automatic tracking</h3>
        <p className="small muted">Link Health Connect to read steps, sleep, calories burned and weight from your phone, Google Fit or smartwatch — no typing needed.</p>
        <Button className="full" onClick={health}>{connected ? '✅ Health Connect linked · resync' : 'Connect Health Connect'}</Button>
        <Toggle label="Auto-log planned meals when their time passes" on={p.autoPlan} set={(v) => updateProfile({ autoPlan: v })} />
        <Toggle label="Reminders (meals, water, desk breaks, bedtime)" on={p.reminders} set={(v) => { updateProfile({ reminders: v }); setTimeout(scheduleReminders, 300); }} />
      </Card>

      <Card>
        <h3>👤 Profile</h3>
        <Field label="Name"><input className="input" value={p.name} onChange={str('name')} placeholder="Your name" /></Field>
        <div className="grid3">
          <Field label="Age"><input className="input" type="number" value={p.age} onChange={num('age')} /></Field>
          <Field label="Height cm"><input className="input" type="number" value={p.heightCm} onChange={num('heightCm')} /></Field>
          <Field label="Weight kg"><input className="input" type="number" value={p.weightKg} onChange={num('weightKg')} /></Field>
        </div>
        <div className="seg small-seg">
          {['male', 'female'].map((s) => <button key={s} className={p.sex === s ? 'on' : ''} onClick={() => updateProfile({ sex: s })}>{p.sex === s && <motion.div layoutId="sexpill" className="seg-pill" />}<span>{s}</span></button>)}
        </div>
        <div className="seg small-seg">
          {[['lose', 'Lose fat'], ['maintain', 'Maintain'], ['gain', 'Build muscle']].map(([k, l]) => <button key={k} className={p.goal === k ? 'on' : ''} onClick={() => updateProfile({ goal: k })}>{p.goal === k && <motion.div layoutId="goalpill" className="seg-pill" />}<span>{l}</span></button>)}
        </div>
        <div className="row-between small"><span>BMI</span><b>{bmi(p).toFixed(1)}</b></div>
        <div className="row-between small"><span>Suggested target</span><b>{suggestedKcal(p)} kcal</b></div>
      </Card>

      <Card>
        <h3>🎯 Daily goals</h3>
        <div className="grid2">
          <Field label="Calories (nutritionist: 1650)"><input className="input" type="number" value={p.targetKcal} onChange={num('targetKcal')} /></Field>
          <Field label="Water glasses"><input className="input" type="number" value={p.waterGoal} onChange={num('waterGoal')} /></Field>
          <Field label="Steps"><input className="input" type="number" value={p.stepGoal} onChange={num('stepGoal')} /></Field>
          <Field label="Sleep hours"><input className="input" type="number" value={p.sleepGoalH} onChange={num('sleepGoalH')} /></Field>
        </div>
      </Card>

      <Card>
        <h3>⏰ Schedule</h3>
        <div className="grid2">
          <Field label="Wake up"><input className="input" type="time" value={p.wake} onChange={str('wake')} /></Field>
          <Field label="Bed time"><input className="input" type="time" value={p.bed} onChange={str('bed')} /></Field>
          <Field label="Work starts"><input className="input" type="time" value={p.workStart} onChange={str('workStart')} /></Field>
          <Field label="Work ends"><input className="input" type="time" value={p.workEnd} onChange={str('workEnd')} /></Field>
        </div>
        <Button variant="ghost" className="full" onClick={() => { scheduleReminders(); toast('⏰ Reminders updated'); }}>Apply schedule to reminders</Button>
      </Card>

      <Card>
        <h3>🥗 Diet</h3>
        <div className="row gap wrap">
          <Pill color="#2ed573">🌱 Vegetarian</Pill><Pill color="#74b9ff">🚭 Non-smoker</Pill><Pill color="#a29bfe">🚫🍺 Non-alcoholic</Pill>
        </div>
        <p className="tiny muted">Non-veg mode will arrive in a future version — the data model already supports it.</p>
      </Card>

      <Card>
        <h3>💾 Data</h3>
        <p className="tiny muted">All data stays on this phone. No account, no cloud.</p>
        <div className="row gap">
          <Button variant="ghost" onClick={exportData}>Export backup</Button>
          <Button variant="danger" onClick={() => { if (confirm('Delete all logged days? Profile is kept.')) { setState({ days: {}, weights: [] }); toast('Cleared'); } }}>Clear history</Button>
        </div>
      </Card>
      <div className="tiny muted center-text">VegVital 1.0 · made for you 💚</div>
      <div style={{ height: 110 }} />
    </motion.div>
  );
}

function Toggle({ label, on, set }) {
  return (
    <div className="toggle-row" onClick={() => { tap(); set(!on); }}>
      <span className="small">{label}</span>
      <div className={`switch ${on ? 'on' : ''}`}><motion.i layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} /></div>
    </div>
  );
}

export function Onboarding({ done }) {
  const p = useStore((s) => s.profile);
  const [step, setStep] = useState(0);
  const slides = [
    { e: '🌱', t: 'Your veg health coach', d: 'Breakfast to dinner, sleep, work and workouts — tracked in one place.' },
    { e: '📸', t: 'Snap. Done.', d: 'Take a photo of your plate — AI counts calories, protein, carbs, fat and fibre for you.' },
    { e: '⚡', t: 'Almost zero typing', d: 'Your nutritionist’s plan auto-logs, steps & sleep come from your phone, reminders keep you on track.' },
  ];
  const next = async () => {
    tap();
    if (step < slides.length) return setStep(step + 1);
    updateProfile({ targetKcal: p.targetKcal || 1650 });
    setState({ onboarded: true });
    if (await healthAvailable()) await connectHealth();
    scheduleReminders();
    done();
  };
  return (
    <div className="onboard">
      <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      <AnimatePresence mode="wait">
        {step < slides.length ? (
          <motion.div key={step} className="slide" initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -80 }} transition={{ type: 'spring', stiffness: 200, damping: 24 }}>
            <motion.div className="slide-emoji" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 0.15 }}>{slides[step].e}</motion.div>
            <h1>{slides[step].t}</h1>
            <p className="muted">{slides[step].d}</p>
          </motion.div>
        ) : (
          <motion.div key="form" className="slide" initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }}>
            <h1>About you</h1>
            <p className="muted small">Only once. Everything else is automatic.</p>
            <input className="input" placeholder="Your name" value={p.name} onChange={(e) => updateProfile({ name: e.target.value })} />
            <div className="grid3">
              <Field label="Age"><input className="input" type="number" value={p.age} onChange={(e) => updateProfile({ age: +e.target.value })} /></Field>
              <Field label="Height cm"><input className="input" type="number" value={p.heightCm} onChange={(e) => updateProfile({ heightCm: +e.target.value })} /></Field>
              <Field label="Weight kg"><input className="input" type="number" value={p.weightKg} onChange={(e) => updateProfile({ weightKg: +e.target.value })} /></Field>
            </div>
            <p className="tiny muted">Calorie target is set to your nutritionist’s 1650 kcal plan. Change it anytime in Settings.</p>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="dots">{[0, 1, 2, 3].map((k) => <motion.i key={k} animate={{ width: k === step ? 22 : 8, opacity: k === step ? 1 : 0.4 }} />)}</div>
      <Button className="full" onClick={next}>{step < slides.length ? 'Next →' : 'Start my journey 🚀'}</Button>
    </div>
  );
}
