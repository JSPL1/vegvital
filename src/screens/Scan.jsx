import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { useStore, updateDay, getState, getDay } from '../lib/store.js';
import { analyzeWithProfile, activeProvider, shrinkImage } from '../lib/ai.js';
import { queuePhoto, importGalleryPhotos } from '../lib/pending.js';
import { newPhotoId, savePhotoFile, addDiary } from '../lib/photos.js';
import { dayTotals, burned } from '../lib/calc.js';
import { MEAL_SLOTS, planForDate } from '../data/plan.js';
import { sumNutrition, FOODS, healthScore } from '../data/foods.js';
import { Button, Ring, CountUp, tap } from '../components/ui.jsx';

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
function guessSlot() {
  const d = new Date(); const n = d.getHours() * 60 + d.getMinutes();
  let best = MEAL_SLOTS[0], diff = 1e9;
  for (const s of MEAL_SLOTS) { const df = Math.abs(toMin(s.time) - n); if (df < diff) { diff = df; best = s; } }
  return best.key;
}

const MSGS = ['Spotting every item on your plate…', 'Estimating portion sizes…', 'Counting oil & ghee…', 'Calculating protein & fibre…', 'Scoring how healthy it is…'];

export default function Scan({ onClose, initialSlot, go }) {
  const profile = useStore((s) => s.profile);
  const provider = activeProvider(profile);
  const [img, setImg] = useState(null);
  const [stage, setStage] = useState('camera'); // camera | analyzing | result | error
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [slot, setSlot] = useState(initialSlot || guessSlot());
  const [msg, setMsg] = useState(0);
  const [busyNote, setBusyNote] = useState('');
  const lastB64 = useRef(null);
  const smallB64 = useRef(null);
  const [pendingId, setPendingId] = useState(null);
  const photoId = useRef(null);
  const [imported, setImported] = useState(0);

  useEffect(() => { if (stage !== 'analyzing') return; const t = setInterval(() => setMsg((m) => (m + 1) % MSGS.length), 1600); return () => clearInterval(t); }, [stage]);
  useEffect(() => { if (Capacitor.isNativePlatform()) capture(CameraSource.Camera); }, []);

  async function capture(source) {
    try {
      let dataUrl;
      if (Capacitor.isNativePlatform()) {
        const p = await Camera.getPhoto({ quality: 80, resultType: CameraResultType.DataUrl, source, width: 1600, correctOrientation: true });
        dataUrl = p.dataUrl;
      } else {
        dataUrl = await pickFileWeb();
      }
      if (!dataUrl) return;
      const small = await shrinkImage(dataUrl);
      setImg(small.dataUrl);
      lastB64.current = small.base64;
      try { smallB64.current = (await shrinkImage(dataUrl, 768)).base64; } catch { smallB64.current = small.base64; }
      photoId.current = newPhotoId();
      savePhotoFile(photoId.current, smallB64.current);
      setPendingId(null);
      run(small.base64);
    } catch (e) {
      if (String(e?.message || e).toLowerCase().includes('cancel')) return;
      setErr(String(e?.message || e)); setStage('error');
    }
  }

  async function run(base64) {
    if (provider === 'offline') { setStage('pick'); return; }
    setStage('analyzing'); setBusyNote('');
    try {
      const p = getState().profile;
      const d = getDay();
      const remaining = p.targetKcal - dayTotals(d).kcal + burned(d, p.weightKg);
      const label = MEAL_SLOTS.find((s) => s.key === slot)?.label;
      const r = await analyzeWithProfile(p, { base64, mealLabel: label, remainingKcal: remaining, onStatus: setBusyNote });
      if (!r.is_food) { setErr('No food found in that photo. Try again with the plate in frame.'); setStage('error'); return; }
      setRes(r); setStage('result');
    } catch (e) {
      const m = String(e?.message || e);
      const keyBad = e?.status === 401;
      if (!keyBad) {
        // never block logging: save the photo for automatic re-analysis and let the user quick-pick now
        if (!pendingId) {
          addDiary({ id: photoId.current, slot, status: 'waiting' });
          setPendingId(queuePhoto({ photoId: photoId.current, slot }));
        }
        setErr(m);
        setStage('pick');
        return;
      }
      setErr(keyBad ? 'Your login has expired. Please log in again.' : m);
      setStage('error');
    }
  }

  function save() {
    tap();
    updateDay((d) => {
      const meals = { ...d.meals };
      meals[slot] = { items: res.items, source: res.quick ? 'quick-pick' : 'photo', time: new Date().toISOString(), name: res.meal_name, score: res.health_score, photoId: photoId.current || undefined, ...(res.quick && pendingId ? { pendingId } : {}) };
      return { ...d, meals };
    });
    if (photoId.current) addDiary({ id: photoId.current, slot, status: res.quick && pendingId ? 'waiting' : 'done', name: res.meal_name, kcal: Math.round(sumNutrition(res.items).kcal) });
    onClose(true);
  }

  const setQty = (i, q) => setRes((r) => ({ ...r, items: r.items.map((it, j) => (j === i ? { ...it, qty: q } : it)) }));
  const total = res ? sumNutrition(res.items) : null;

  return (
    <motion.div className="scan" initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
      <div className="scan-top">
        <button className="icon-btn" onClick={() => onClose(false)}>✕</button>
        <div className="slot-scroll">
          {MEAL_SLOTS.map((s) => (
            <button key={s.key} className={`chipbtn ${slot === s.key ? 'on' : ''}`} onClick={() => setSlot(s.key)}>{s.icon} {s.label}</button>
          ))}
        </div>
      </div>

      <div className="scan-photo">
        {img ? <motion.img src={img} initial={{ scale: 1.2, filter: 'blur(10px)' }} animate={{ scale: 1, filter: 'blur(0px)' }} /> : (
          <div className="scan-empty">
            <motion.div className="cam-big" animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 2 }}>📷</motion.div>
            <p className="muted">Point at your plate</p>
          </div>
        )}
        {stage === 'analyzing' && (
          <>
            <motion.div className="scanline" animate={{ top: ['0%', '100%', '0%'] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />
            <div className="corners"><i /><i /><i /><i /></div>
            {[...Array(10)].map((_, i) => (
              <motion.span key={i} className="spark-dot" style={{ left: `${10 + Math.random() * 80}%`, top: `${10 + Math.random() * 80}%` }}
                animate={{ opacity: [0, 1, 0], scale: [0, 1.4, 0] }} transition={{ duration: 1.6, delay: i * 0.2, repeat: Infinity }} />
            ))}
          </>
        )}
      </div>

      <AnimatePresence mode="wait">
        {stage === 'analyzing' && (
          <motion.div key="a" className="scan-panel center col" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="loader"><span /><span /><span /></div>
            <AnimatePresence mode="wait">
              <motion.p key={msg} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="small">{busyNote || MSGS[msg]}</motion.p>
            </AnimatePresence>
          </motion.div>
        )}

        {stage === 'camera' && (
          <motion.div key="c" className="scan-panel col gap" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <div className="row gap">
              <Button className="grow" onClick={() => capture(CameraSource.Camera)}>📸 Take photo</Button>
              <Button variant="ghost" onClick={() => capture(CameraSource.Photos)}>🖼️ One photo</Button>
            </div>
            <Button variant="ghost" onClick={async () => {
              try {
                const n = await importGalleryPhotos();
                if (n) { setImported(n); setTimeout(() => onClose(false), 1600); }
              } catch (e) { if (!String(e?.message || e).toLowerCase().includes('cancel')) { setErr(String(e?.message || e)); setStage('error'); } }
            }}>🗂️ Add many food photos from gallery</Button>
            {imported > 0 && <div className="tiny center">✅ {imported} photo{imported > 1 ? 's' : ''} saved — the AI will read them one by one in the background</div>}
          </motion.div>
        )}

        {stage === 'pick' && (
          <QuickPick key="q" slot={slot} queued={!!pendingId} reason={err} onDone={(r) => { setRes(r); setStage('result'); }}
            onSetup={() => { onClose(false); go('settings'); }} />
        )}

        {stage === 'error' && (
          <motion.div key="e" className="scan-panel col gap" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <b>😕 Couldn’t analyse</b>
            <p className="small muted">{err}</p>
            <div className="row gap wrap">{lastB64.current && <Button className="grow" onClick={() => run(lastB64.current)}>🔁 Try again</Button>}<Button variant={lastB64.current ? 'ghost' : 'primary'} onClick={() => capture(CameraSource.Camera)}>📸 Retake</Button><Button variant="ghost" onClick={() => setStage('pick')}>👆 Quick-pick</Button><Button variant="ghost" onClick={() => onClose(false)}>Close</Button></div>
          </motion.div>
        )}

        {stage === 'result' && res && (
          <motion.div key="r" className="scan-panel result" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 22 }}>
            {res.contains_non_veg && <div className="alert">⚠️ This looks like it may contain non-veg. Double-check before eating.</div>}
            {res.contains_alcohol && <div className="alert">🚫 Alcohol detected — not part of your plan.</div>}
            <div className="row gap center-v">
              <Ring size={92} stroke={9} value={res.health_score} max={10} colors={res.health_score >= 7 ? ['#00f5a0', '#00d9f5'] : res.health_score >= 4 ? ['#ffd166', '#ff9f43'] : ['#ff6b6b', '#ee5253']} id="hs">
                <b className="big2"><CountUp value={res.health_score} /></b><span className="tiny muted">/10</span>
              </Ring>
              <div className="grow">
                <div className="b">{res.meal_name}</div>
                <div className="big2 grad"><CountUp value={total.kcal} /> <small>kcal</small></div>
                <div className="small muted">{res.verdict}</div>
              </div>
            </div>
            <div className="macro-chips">
              <span className="chip p">P {Math.round(total.p)}g</span>
              <span className="chip c">C {Math.round(total.c)}g</span>
              <span className="chip f">F {Math.round(total.f)}g</span>
              <span className="chip fb">Fb {Math.round(total.fb)}g</span>
            </div>
            <div className="items">
              {res.items.map((it, i) => (
                <motion.div key={it.id} className="item" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.08 }}>
                  <span className="emoji">{it.emoji}</span>
                  <div className="grow"><div className="small">{it.name}</div><div className="tiny muted">{it.serving}{it.confidence < 0.6 ? ' · unsure' : ''}</div></div>
                  <div className="qty">
                    <button onClick={() => setQty(i, Math.max(0, +(it.qty - 0.5).toFixed(1)))}>−</button>
                    <span>{it.qty}×</span>
                    <button onClick={() => setQty(i, +(it.qty + 0.5).toFixed(1))}>+</button>
                  </div>
                  <b className="tiny">{Math.round(it.kcal * it.qty)}</b>
                </motion.div>
              ))}
            </div>
            <div className="tip-line small">💡 {res.tip}</div>
            <Button className="full" onClick={save}>✓ Save to {MEAL_SLOTS.find((s) => s.key === slot)?.label}</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const EXTRA_IDS = ['steamed_veg_bowl', 'steamed_veg_small', 'salad', 'onion_raw', 'oil_tsp'];
const SNACK = ['Snack', 'Fruit', 'Drinks', 'Breakfast', 'Sweets', 'Dairy'];
const MAIN = ['Dal', 'Sabzi', 'Grains', 'Protein', 'Dairy', 'Snack'];
const CAT_ORDER = { pre: ['Nuts', 'Drinks', 'Fruit'], breakfast: ['Breakfast', 'Dairy', 'Protein', 'Fruit', 'Drinks'], msnack: SNACK, lunch: MAIN, esnack: SNACK, dinner: MAIN, post: ['Dairy', 'Drinks', 'Fruit', 'Sweets'] };

// Free, offline: tap what's on the plate (your plan's items for this meal come first).
function QuickPick({ slot, onDone, onSetup, queued, reason }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState([]);
  const planned = planForDate().meals[slot]?.items || [];
  const plannedIds = new Set(planned.map((i) => i.id));
  const list = q
    ? FOODS.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())).slice(0, 24)
    : [...planned, ...FOODS.filter((f) => !plannedIds.has(f.id) && EXTRA_IDS.includes(f.id)), ...FOODS.filter((f) => !plannedIds.has(f.id) && !EXTRA_IDS.includes(f.id) && CAT_ORDER[slot].includes(f.cat)).sort((x, y) => CAT_ORDER[slot].indexOf(x.cat) - CAT_ORDER[slot].indexOf(y.cat)).slice(0, 36)];
  const toggle = (f) => { tap(); setPicked((p) => (p.some((x) => x.id === f.id) ? p.filter((x) => x.id !== f.id) : [...p, f])); };
  const done = () => {
    const items = picked.map((f) => ({ ...f, id: 'qp_' + f.id, qty: 1 }));
    const n = sumNutrition(items);
    const score = healthScore(n, picked.flatMap((f) => f.tags || []));
    onDone({
      is_food: true, meal_name: picked.map((f) => f.name).slice(0, 2).join(' + ') || 'Meal', items,
      health_score: score,
      verdict: score >= 7 ? 'Balanced, protein-smart choice 👍' : score >= 4 ? 'Okay — could use more protein or veggies' : 'Heavy meal — keep the next one light',
      tip: n.p < 15 ? 'Add curd, paneer, dal or sprouts for protein.' : n.fb < 5 ? 'Add a salad or sabzi for fibre.' : 'Great — remember a glass of water.',
      contains_non_veg: false, contains_alcohol: false, quick: true,
    });
  };
  return (
    <motion.div className="scan-panel result col gap" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
      {queued && (
        <div className="queued">
          <b className="small">📶 The food AI is busy — your photo is saved</b>
          <div className="tiny muted">Log it now with a quick pick. The photo is re-checked automatically in the background and the exact AI numbers will replace this estimate.</div>
          {reason && <div className="tiny muted" style={{ opacity: 0.6, marginTop: 4 }}>{reason}</div>}
        </div>
      )}
      <div className="row-between"><b>👆 Tap what’s on your plate</b><span className="tiny muted">free · offline</span></div>
      <div className="search"><span>🔎</span><input placeholder="Search foods…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="pick-grid">
        {list.map((f) => {
          const on = picked.some((x) => x.id === f.id);
          return (
            <motion.button key={f.id} className={`pick ${on ? 'on' : ''}`} whileTap={{ scale: 0.9 }} onClick={() => toggle(f)}>
              <span className="emoji">{f.emoji}</span>
              <span className="tiny">{f.name}</span>
              <span className="tiny muted">{f.kcal} kcal{plannedIds.has(f.id) ? ' · plan' : ''}</span>
            </motion.button>
          );
        })}
      </div>
      <Button className="full" disabled={!picked.length} onClick={done}>Continue with {picked.length} item{picked.length === 1 ? '' : 's'} →</Button>
      {!queued && <button className="tiny muted link" onClick={onSetup}>Want automatic photo reading? Turn on AI photo reading in Settings</button>}
    </motion.div>
  );
}

function pickFileWeb() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = () => {
      const f = input.files?.[0]; if (!f) return resolve(null);
      const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(f);
    };
    input.click();
  });
}
