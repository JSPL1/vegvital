import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore, updateProfile, suggestedKcal, bmi, setState, getState } from '../lib/store.js';
import { connectHealth, scheduleReminders, healthAvailable } from '../lib/auto.js';
import { backupNow, pickAndRestore, backupAgeDays } from '../lib/backup.js';
import { getSession, logout, api } from '../lib/api.js';
import { pushNow } from '../lib/sync.js';
import { Card, stagger, rise, Button, Pill, tap } from '../components/ui.jsx';

function Field({ label, children }) {
  return <label className="field"><span className="tiny muted">{label}</span>{children}</label>;
}

export default function Settings({ back, toast }) {
  const p = useStore((s) => s.profile);
  const connected = useStore((s) => s.healthConnected);
  useStore((s) => s.lastBackup);
  const age = backupAgeDays();
  const user = getSession()?.user;
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '' });
  const num = (k) => (e) => updateProfile({ [k]: Number(e.target.value) });
  const str = (k) => (e) => updateProfile({ [k]: e.target.value });

  async function changePw() {
    try { await api('/api/me/password', { method: 'POST', body: pw }); setPw({ current: '', next: '' }); setPwOpen(false); toast('✅ Password changed'); }
    catch (e) { toast('❌ ' + String(e?.message || e).slice(0, 80)); }
  }

  async function deleteAccount() {
    const pass = prompt('This permanently deletes your VegVital account, all your meals, reports and food photos. Enter your password to confirm:');
    if (!pass) return;
    try { await api('/api/me/delete', { method: 'POST', body: { password: pass } }); await logout(); }
    catch (e) { toast('❌ ' + String(e?.message || e).slice(0, 80)); }
  }

  async function signOut() {
    if (!confirm('Log out of VegVital on this phone? Your data stays safe in your account.')) return;
    await pushNow();
    await logout();
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

      <Card glow="#00d9f5">
        <h3>👤 Account</h3>
        <div className="row-between small"><span>Logged in as</span><b>{user?.email}</b></div>
        <p className="tiny muted">Your meals, food photos and reports are saved to your account automatically and show on any phone you log in from.</p>
        {pwOpen ? (
          <div className="col gap">
            <input className="input" type="password" placeholder="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            <input className="input" type="password" placeholder="New password (6+ characters)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            <Button onClick={changePw} disabled={!pw.current || pw.next.length < 6}>Save new password</Button>
          </div>
        ) : (
          <div className="row gap">
            <Button variant="ghost" className="grow" onClick={() => setPwOpen(true)}>🔑 Change password</Button>
            <Button variant="danger" onClick={signOut}>Log out</Button>
          </div>
        )}
        <button className="tiny muted link" style={{ marginTop: 10 }} onClick={deleteAccount}>Delete my account and data</button>
      </Card>

      <Card>
        <h3>📸 Food photo reading</h3>
        <Toggle label="Read my food photos automatically with AI" on={p.aiProvider !== 'offline'} set={(v) => updateProfile({ aiProvider: v ? 'auto' : 'offline' })} />
        <p className="tiny muted">{p.aiProvider === 'offline' ? 'Off: after a photo you tap the foods on your plate and the app counts them from its food chart.' : 'On: the app reads every food photo and counts kcal, protein, carbs, fat and fibre. If it is busy, the photo is saved and read later.'}</p>
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

      <Card glow="#ffd166">
        <h3>💾 Backup & restore</h3>
        <p className="small muted">Uninstalling Android apps deletes their data. Keep a backup so your history, profile and plan come back on reinstall or a new phone.</p>
        <div className="backup-row">
          <span className="tiny muted grow">Last backup: <b className="white">{age == null ? "never" : age === 0 ? "today" : age + " days ago"}</b></span>
          {age == null || age > 7 ? <Pill color="#ff6b6b">due</Pill> : <Pill color="#00f5a0">safe</Pill>}
        </div>
        <div className="row gap" style={{ marginTop: 10 }}>
          <Button className="grow" onClick={async () => { try { await backupNow(); toast("✅ Backup created — save it to Google Drive or WhatsApp"); } catch (e) { toast("❌ " + String(e?.message || e).slice(0, 80)); } }}>⬆️ Back up now</Button>
          <Button variant="ghost" onClick={async () => { try { const r = await pickAndRestore(); if (r) toast(`✅ Restored ${r.days} days of history`); } catch (e) { toast("❌ " + String(e?.message || e)); } }}>⬇️ Restore</Button>
        </div>
        <ul className="list tiny muted">
          <li>☁️ Tap <b>Back up now</b> → choose <b>Google Drive</b> (or WhatsApp → Message yourself)</li>
          <li>☁️ Everything is also saved in your account — just log in again after a reinstall</li>
          <li>💾 A copy is also saved automatically every day to <b>Documents/VegVital</b> on your phone</li>
          <li>📲 After reinstalling: on the first screen tap <b>Restore from backup</b> and pick that file</li>
          <li>🔄 Android Google Backup also restores automatically if it’s on: Settings → Google → Backup → “Back up to Google Drive” ON</li>
        </ul>
        <Button variant="danger" onClick={() => { if (confirm("Delete all logged days? Profile is kept.")) { setState({ days: {}, weights: [] }); toast("Cleared"); } }}>Clear history</Button>
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
  const [rmsg, setRmsg] = useState('');
  const restore = async () => {
    tap();
    try {
      const r = await pickAndRestore();
      if (!r) return;
      if (await healthAvailable()) await connectHealth();
      scheduleReminders();
      done();
    } catch (e) { setRmsg(String(e?.message || e)); }
  };
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
      <button className="restore-link" onClick={restore}>♻️ Already used VegVital? <b>Restore from backup</b></button>
      <div className="tiny muted center-text" style={{ position: 'relative' }}>Your daily auto-copy is in <b>Documents › VegVital</b></div>
      {rmsg && <div className="tiny warn center-text" style={{ position: 'relative' }}>⚠️ {rmsg}</div>}
    </div>
  );
}
