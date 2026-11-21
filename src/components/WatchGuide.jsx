import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, Pill, tap } from './ui.jsx';

// How each watch's data reaches VegVital. Budget watches can't talk to Health Connect
// directly, so we route them: watch app → Google Fit → Health Connect → VegVital.
const GFIT = [
  'Install Google Fit (Play Store) and sign in with your Gmail',
  'Google Fit → Profile → ⚙️ Settings → turn ON "Sync Fit with Health Connect"',
];
const HSYNC = 'No Google Fit option in your watch app? Install "Health Sync" (Play Store) — it copies data from NoiseFit, boAt, Da Fit and many more into Health Connect.';

const BRANDS = [
  { id: 'noise', name: 'Noise', app: 'NoiseFit', level: 'via Google Fit', color: '#ffd166',
    steps: [GFIT[0], 'Open NoiseFit → Profile', 'Tap "Connected apps" / "Third-party apps" → Google Fit → Connect & allow', GFIT[1]],
    data: 'Steps, sleep, heart rate, workouts (SpO₂ usually not shared)' },
  { id: 'boat', name: 'boAt', app: 'boAt Crest / boAt Wave', level: 'via Google Fit', color: '#ff6b6b',
    steps: [GFIT[0], 'Open boAt Crest → Profile → Settings', 'Tap "Google Fit" → Connect & allow', GFIT[1]],
    data: 'Steps, sleep, heart rate (depends on model)' },
  { id: 'fireboltt', name: 'Fire-Boltt', app: 'Fire-Boltt / Da Fit', level: 'via Google Fit or Health Sync', color: '#ff9f43',
    steps: [GFIT[0], 'Open the Fire-Boltt (or Da Fit) app → Profile → Settings', 'Look for "Google Fit" → Connect & allow', GFIT[1]],
    data: 'Steps, sleep, heart rate on most models', note: HSYNC },
  { id: 'other-budget', name: 'Pebble, Fastrack, Titan, Ambrane, others', app: 'their companion app', level: 'via Google Fit or Health Sync', color: '#a29bfe',
    steps: [GFIT[0], 'In the watch app, open Settings and look for "Google Fit" or "Health Connect"', GFIT[1]],
    data: 'Varies by brand', note: HSYNC },
  { id: 'samsung', name: 'Samsung Galaxy Watch', app: 'Samsung Health', level: 'direct', color: '#4facfe',
    steps: ['Samsung Health → ☰ / Profile → ⚙️ Settings → Health Connect', 'Allow Samsung Health to write all data'],
    data: 'Everything: steps, HR, SpO₂, HRV, sleep stages, workouts, weight' },
  { id: 'fitbit', name: 'Fitbit / Pixel Watch', app: 'Fitbit', level: 'direct', color: '#00d9f5',
    steps: ['Fitbit app → You → Settings → Health Connect → Turn on', 'Allow all data types'],
    data: 'Everything incl. sleep stages, HRV, SpO₂' },
  { id: 'amazfit', name: 'Amazfit', app: 'Zepp', level: 'direct', color: '#00f5a0',
    steps: ['Zepp → Profile → Add accounts → Health Connect', 'Allow all data types'],
    data: 'Steps, HR, sleep, SpO₂, workouts' },
  { id: 'mi', name: 'Xiaomi / Redmi band', app: 'Mi Fitness', level: 'direct', color: '#fd79a8',
    steps: ['Mi Fitness → Profile → Third-party data → Health Connect', 'Turn on all toggles'],
    data: 'Steps, HR, sleep, workouts' },
  { id: 'garmin', name: 'Garmin / OnePlus / others', app: 'their app', level: 'direct / via Google Fit', color: '#74b9ff',
    steps: ['In the app settings, open "Connected apps" → Health Connect (or Google Fit)', ...GFIT],
    data: 'Steps, HR, sleep, workouts' },
  { id: 'phone', name: 'No watch — just my phone', app: 'Google Fit or Samsung Health', level: 'direct', color: '#2ed573',
    steps: ['Install Google Fit (or use Samsung Health) — it counts steps with the phone sensor all day', ...GFIT.slice(1)],
    data: 'Steps, walks, distance; sleep is estimated by VegVital' },
];

export default function WatchGuide({ open, onClose }) {
  const [sel, setSel] = useState(null);
  const b = BRANDS.find((x) => x.id === sel);
  return (
    <Sheet open={open} onClose={() => { setSel(null); onClose(); }} title={b ? `⌚ ${b.name}` : '⌚ Which watch do you have?'}>
      <AnimatePresence mode="wait">
        {!b ? (
          <motion.div key="list" className="brand-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {BRANDS.map((x, i) => (
              <motion.button key={x.id} className="brand" style={{ '--c': x.color }} whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                onClick={() => { tap(); setSel(x.id); }}>
                <b className="small">{x.name}</b>
                <span className="tiny muted">{x.level}</span>
              </motion.button>
            ))}
          </motion.div>
        ) : (
          <motion.div key="steps" className="col gap" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
            <div className="row gap wrap"><Pill color={b.color}>App: {b.app}</Pill><Pill color="#00f5a0">{b.level}</Pill></div>
            <ol className="steps">
              {b.steps.map((s, i) => <li key={s}><span className="num">{i + 1}</span><span>{s}</span></li>)}
              <li><span className="num">{b.steps.length + 1}</span><span>Back in VegVital → Today → <b>Connect via Health Connect</b> → allow all</span></li>
            </ol>
            <div className="tip-line small">📊 Syncs: {b.data}</div>
            {b.note && <div className="tiny muted">💡 {b.note}</div>}
            <div className="tiny muted">Menu names can differ slightly between app versions. Data usually appears within a few minutes after the watch app syncs.</div>
            <button className="tiny muted link" onClick={() => setSel(null)}>← Other brands</button>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}
