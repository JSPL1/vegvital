import { useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../lib/store.js';
import { connectHealth, syncHealth } from '../lib/auto.js';
import { Card, Pill, Sparkline, CountUp, Button } from './ui.jsx';

const ago = (iso) => {
  if (!iso) return 'never';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

export default function WatchCard() {
  const connected = useStore((s) => s.healthConnected);
  const w = useStore((s) => s.watch) || {};
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const connect = async () => {
    setBusy(true);
    const r = await connectHealth();
    setMsg(r.ok ? '' : r.reason || 'Permission not granted');
    setBusy(false);
  };
  const sync = async () => { setBusy(true); await syncHealth(); setBusy(false); };

  if (!connected) {
    return (
      <Card className="watch" glow="#ff6b6b">
        <div className="row gap center-v">
          <motion.div className="watch-ico" animate={{ rotate: [0, -8, 8, 0] }} transition={{ repeat: Infinity, duration: 3 }}>⌚</motion.div>
          <div className="grow">
            <b>Connect your smartwatch</b>
            <div className="tiny muted">Heart rate, SpO₂, sleep, steps & watch workouts sync automatically. Meals, water & workouts you log here go back to your watch app.</div>
          </div>
        </div>
        <Button className="full" onClick={connect} disabled={busy}>{busy ? 'Connecting…' : 'Connect via Health Connect'}</Button>
        {msg && <div className="tiny warn" style={{ marginTop: 8 }}>⚠️ {msg}. Make sure your watch app (Samsung Health, Google Fit, Fitbit, Zepp, Noise/boAt…) has Health Connect sync turned on.</div>}
      </Card>
    );
  }

  const beat = w.hr ? 60 / w.hr : 1;
  return (
    <Card className="watch" glow="#ff6b6b">
      <div className="row-between">
        <span className="b">⌚ {w.device || 'Smartwatch'}</span>
        <motion.button className="sync" whileTap={{ scale: 0.9 }} onClick={sync} disabled={busy}>
          <motion.span animate={busy ? { rotate: 360 } : { rotate: 0 }} transition={busy ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : {}}>⟳</motion.span>
          <span className="tiny muted">{busy ? 'syncing' : ago(w.lastSync)}</span>
        </motion.button>
      </div>
      <div className="hr-row">
        <div className="heart-wrap">
          <motion.div className="heart" animate={{ scale: [1, 1.22, 1, 1.12, 1] }} transition={{ repeat: Infinity, duration: beat * 1.0, ease: 'easeInOut' }}>❤️</motion.div>
          <motion.div className="heart-ring" animate={{ scale: [0.8, 1.6], opacity: [0.6, 0] }} transition={{ repeat: Infinity, duration: beat * 1.0 }} />
        </div>
        <div>
          <div className="big"><CountUp value={w.hr || 0} /><small className="muted"> bpm</small></div>
          <div className="tiny muted">{w.hr ? `low ${w.hrMin} · avg ${w.hrAvg} · high ${w.hrMax}` : 'No heart rate today yet'}</div>
        </div>
      </div>
      {w.hrTrend && w.hrTrend.some(Boolean) && <Sparkline data={w.hrTrend.map((x) => x || null).filter((x) => x !== null)} color="#ff6b6b" height={34} />}
      <div className="vitals">
        <div><span className="tiny muted">Resting</span><b>{w.rhr ?? '—'}</b><span className="tiny muted">bpm</span></div>
        <div><span className="tiny muted">SpO₂</span><b>{w.spo2 ?? '—'}</b><span className="tiny muted">%</span></div>
        <div><span className="tiny muted">HRV</span><b>{w.hrv ?? '—'}</b><span className="tiny muted">ms</span></div>
        <div><span className="tiny muted">Distance</span><b>{w.km ?? '—'}</b><span className="tiny muted">km</span></div>
      </div>
      <div className="tiny muted" style={{ marginTop: 8 }}>🔁 Two-way sync on · food, water & workouts are sent to your watch app</div>
    </Card>
  );
}
