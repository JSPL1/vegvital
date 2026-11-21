import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from './lib/store.js';
import { startAutomation } from './lib/auto.js';
import { startUpdateChecks, installUpdate } from './lib/update.js';
import Home from './screens/Home.jsx';
import Food from './screens/Food.jsx';
import Scan from './screens/Scan.jsx';
import Move, { Confetti } from './screens/Move.jsx';
import Insights from './screens/Insights.jsx';
import Settings, { Onboarding } from './screens/Settings.jsx';
import { Toast, tap } from './components/ui.jsx';

const TABS = [
  ['home', 'Today', '◉'],
  ['food', 'Food', '🍽'],
  ['scan', '', '📸'],
  ['move', 'Move', '⚡'],
  ['insights', 'Stats', '📊'],
];

export default function App() {
  const onboarded = useStore((s) => s.onboarded);
  const pendingDone = useStore((s) => s.pendingDone);
  const update = useStore((s) => s.update);
  const [hideUpd, setHideUpd] = useState(false);
  const [tab, setTab] = useState('home');
  const [prev, setPrev] = useState('home');
  const [scan, setScan] = useState(null); // null | {slot}
  const [moveStart, setMoveStart] = useState(null);
  const [toast, setToast] = useState('');
  const [party, setParty] = useState(false);

  useEffect(() => { startAutomation(); startUpdateChecks(); }, []);
  useEffect(() => { if (pendingDone) setToast(`✨ AI updated ${pendingDone.count} meal${pendingDone.count > 1 ? 's' : ''} from your saved photo${pendingDone.count > 1 ? 's' : ''}`); }, [pendingDone?.at]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2800); return () => clearTimeout(t); }, [toast]);

  const go = (t, arg) => {
    tap();
    if (t === 'scan') return setScan({ slot: arg });
    if (t === 'move' && arg) setMoveStart(arg);
    setPrev(tab); setTab(t);
  };

  if (!onboarded) return <Onboarding done={() => setTab('home')} />;

  return (
    <div className="app">
      <div className="bg"><div className="blob b1" /><div className="blob b2" /><div className="blob b3" /><div className="grid-bg" /></div>
      <Toast msg={toast} />
      {update && !hideUpd && (
        <motion.div className="update-banner" initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ position: 'relative', zIndex: 5, margin: '12px 14px 0' }}>
          <span style={{ fontSize: 24 }}>⬆️</span>
          <div className="grow"><b>Update {update.version} is ready</b><span className="tiny muted">Installs over this app · your data stays</span></div>
          <button className="chipbtn on" onClick={() => { tap(); installUpdate(update); }}>Update</button>
          <button className="icon-btn" onClick={() => setHideUpd(true)}>✕</button>
        </motion.div>
      )}
      <AnimatePresence mode="wait">
        <motion.main key={tab} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22 }}>
          {tab === 'home' && <Home go={go} openScan={() => go('scan')} toast={setToast} />}
          {tab === 'food' && <Food openScan={(slot) => go('scan', slot)} />}
          {tab === 'move' && <Move startId={moveStart} clearStart={() => setMoveStart(null)} />}
          {tab === 'insights' && <Insights />}
          {tab === 'settings' && <Settings back={() => setTab(prev === 'settings' ? 'home' : prev)} toast={setToast} />}
        </motion.main>
      </AnimatePresence>

      <nav className="tabbar">
        {TABS.map(([k, label, icon]) => k === 'scan' ? (
          <motion.button key={k} className="fab" whileTap={{ scale: 0.88 }} onClick={() => go('scan')}
            animate={{ boxShadow: ['0 0 0 0 rgba(0,245,160,.55)', '0 0 0 14px rgba(0,245,160,0)'] }} transition={{ repeat: Infinity, duration: 1.8 }}>
            <span>{icon}</span>
          </motion.button>
        ) : (
          <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => go(k)}>
            {tab === k && <motion.div layoutId="tabglow" className="tab-glow" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />}
            <motion.span className="tab-icon" animate={{ scale: tab === k ? 1.15 : 1, y: tab === k ? -2 : 0 }}>{icon}</motion.span>
            <span className="tab-label">{label}</span>
          </button>
        ))}
      </nav>

      <AnimatePresence>
        {scan && (
          <Scan initialSlot={scan.slot} go={go} onClose={(saved) => {
            setScan(null);
            if (saved) { setToast('✅ Meal logged from photo'); setParty(true); setTimeout(() => setParty(false), 3000); }
          }} />
        )}
      </AnimatePresence>
      {party && <div className="party"><Confetti n={50} /></div>}
    </div>
  );
}
