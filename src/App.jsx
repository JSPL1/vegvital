import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from './lib/store.js';
import { startAutomation } from './lib/auto.js';
import { loadSession, loggedIn, onSession } from './lib/api.js';
import { pullFromServer, startSync } from './lib/sync.js';
import { replaceState } from './lib/store.js';
import Login from './screens/Login.jsx';
import Home from './screens/Home.jsx';
import Food from './screens/Food.jsx';
import Scan from './screens/Scan.jsx';
import Move, { Confetti } from './screens/Move.jsx';
import Insights from './screens/Insights.jsx';
import History from './screens/History.jsx';
import Settings, { Onboarding } from './screens/Settings.jsx';
import { Toast, tap } from './components/ui.jsx';

const TABS = [
  ['home', 'Today', '◉'],
  ['food', 'Food', '🍽'],
  ['scan', '', '📸'],
  ['history', 'History', '📅'],
  ['move', 'Move', '⚡'],
  ['insights', 'Stats', '📊'],
];

// Login first; after that the app works as before, with data saved to the user's account.
export default function Root() {
  const [phase, setPhase] = useState('loading'); // loading | login | app
  useEffect(() => {
    const enter = async () => {
      try { await pullFromServer(); } catch { /* offline: use what is on the phone */ }
      startSync();
      setPhase('app');
    };
    loadSession().then(() => (loggedIn() ? enter() : setPhase('login')));
    return onSession(() => { if (!loggedIn()) { replaceState(null); setPhase('login'); } });
  }, []);
  if (phase === 'loading') return null;
  if (phase === 'login') return <Login onDone={async () => { try { await pullFromServer(); } catch { /* offline */ } startSync(); setPhase('app'); }} />;
  return <App />;
}

function App() {
  const onboarded = useStore((s) => s.onboarded);
  const pendingDone = useStore((s) => s.pendingDone);
  // #tab=food etc. opens a tab directly (used for store screenshots and links)
  const [tab, setTab] = useState(() => (location.hash.match(/tab=(\w+)/) || [])[1] || 'home');
  const [prev, setPrev] = useState('home');
  const [scan, setScan] = useState(null); // null | {slot}
  const [moveStart, setMoveStart] = useState(null);
  const [toast, setToast] = useState('');
  const [party, setParty] = useState(false);

  useEffect(() => { startAutomation(); }, []);
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
      <AnimatePresence mode="wait">
        <motion.main key={tab} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22 }}>
          {tab === 'home' && <Home go={go} openScan={() => go('scan')} toast={setToast} />}
          {tab === 'food' && <Food openScan={(slot) => go('scan', slot)} />}
          {tab === 'move' && <Move startId={moveStart} clearStart={() => setMoveStart(null)} />}
          {tab === 'insights' && <Insights />}
          {tab === 'history' && <History toast={setToast} />}
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
