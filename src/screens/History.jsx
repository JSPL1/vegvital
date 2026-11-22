import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStore, todayKey } from '../lib/store.js';
import { sumNutrition, findFood } from '../data/foods.js';
import { MEAL_SLOTS } from '../data/plan.js';
import { usePhoto } from '../lib/photos.js';
import { pullAll, cloudOn } from '../lib/cloud.js';
import { importGalleryPhotos } from '../lib/pending.js';
import PhotoDiary from '../components/PhotoDiary.jsx';
import { Card, stagger, rise, Sheet, Button, Pill, tap } from '../components/ui.jsx';

export function Story({ food }) {
  if (!food?.about) return null;
  return (
    <div className="story">
      <div className="tiny b">📜 History{food.region ? ` · 📍 ${food.region}` : ''}</div>
      <div className="small">{food.about}</div>
    </div>
  );
}

const SRC = { photo: '📸 photo', plan: '✓ plan', 'plan-auto': 'auto', manual: '✍️ added' };

function MiniPhoto({ p, onOpen }) {
  const src = usePhoto(p.id, { thumb: true });
  return (
    <button className="yp-item" onClick={() => onOpen(p)}>
      {src ? <img src={src} alt="" /> : <span>🍽</span>}
      <small>{new Date(p.time).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</small>
    </button>
  );
}

function BigPhoto({ id }) {
  const src = usePhoto(id);
  return src ? <img src={src} alt="" className="pd-big" /> : <div className="tiny muted">Loading photo from cloud…</div>;
}

/** The user's own photos of this food, from every day (pictures come from the cloud). */
export function YourPhotos({ food }) {
  const photos = useStore((s) => s.photos) || {};
  const [big, setBig] = useState(null);
  const mine = Object.values(photos).flat()
    .filter((p) => p.name && (p.name.toLowerCase() === food.name.toLowerCase() || findFood(p.name)?.id === food.id))
    .sort((a, b) => new Date(b.time) - new Date(a.time));
  if (!mine.length) return null;
  return (
    <div className="col gap">
      <div className="tiny b">📷 Your photos of this food ({mine.length})</div>
      <div className="yp-strip">{mine.slice(0, 30).map((p) => <MiniPhoto key={p.id} p={p} onOpen={(x) => { tap(); setBig(big?.id === x.id ? null : x); }} />)}</div>
      {big && <BigPhoto id={big.id} />}
    </div>
  );
}

export default function History({ toast }) {
  const days = useStore((s) => s.days) || {};
  const photos = useStore((s) => s.photos) || {};
  const [limit, setLimit] = useState(14);
  const [pick, setPick] = useState(null);
  useEffect(() => { pullAll(); }, []);
  const keys = [...new Set([...Object.keys(days), ...Object.keys(photos)])]
    .filter((k) => Object.keys(days[k]?.meals || {}).length || (days[k]?.extra || []).length || (photos[k] || []).length)
    .sort().reverse();
  const fmt = (k) => new Date(k + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const tm = (t) => (t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
  const open = (it) => { tap(); const f = findFood(it.name); setPick({ ...it, about: it.about || f?.about, region: it.region || f?.region }); };

  const [busy, setBusy] = useState(false);
  const addOld = async () => {
    tap(); setBusy(true);
    try { const n = await importGalleryPhotos(); if (n) toast?.(`📥 ${n} photo${n > 1 ? 's' : ''} filed by the date they were taken`); } catch { /* cancelled */ }
    setBusy(false);
  };
  return (
    <motion.div className="screen" variants={stagger} initial="hidden" animate="show">
      <motion.header className="top" variants={rise}>
        <h1 className="title">History</h1>
        <Pill color="#74b9ff">{cloudOn() ? '☁️ Cloud' : '📱 Phone'}</Pill>
      </motion.header>
      <Card>
        <div className="row-between">
          <div className="small">Older food photos in your gallery? Add them — each goes to the day and meal it was taken.</div>
          <button className="chipbtn on" disabled={busy} onClick={addOld}>{busy ? 'Saving…' : '＋ Add photos'}</button>
        </div>
      </Card>
      {!keys.length && <Card><div className="small muted">Nothing logged yet. Every meal you log or photograph will show here, date by date.</div></Card>}
      <Card className="plan-total">
        <div><div className="tiny muted">DAYS LOGGED</div><div className="big2">{keys.length}</div></div>
        <div><div className="tiny muted">PHOTOS</div><div className="big2">{Object.values(photos).flat().length}</div></div>
        {keys.length > 0 && <div className="tiny muted right">Since<br /><b>{fmt(keys[keys.length - 1])}</b></div>}
      </Card>
      {keys.slice(0, limit).map((k) => {
        const d = days[k] || {};
        const meals = [
          ...MEAL_SLOTS.filter((s) => d.meals?.[s.key]).map((s) => ({ ...d.meals[s.key], label: s.label, icon: s.icon })),
          ...(d.extra || []).map((e) => ({ ...e, label: e.label || 'Extra', icon: '➕' })),
        ];
        const tot = sumNutrition(meals.flatMap((m) => m.items || []));
        if (!tot.kcal) tot.kcal = (photos[k] || []).reduce((a, p) => a + (Number(p.kcal) || 0), 0);
        return (
          <Card key={k} className="hist-day">
            <div className="row-between">
              <b>📅 {fmt(k)}{k === todayKey() ? ' · Today' : ''}</b>
              <span className="kcal-chip">{Math.round(tot.kcal)}<small>kcal</small></span>
            </div>
            <div className="tiny muted">P {Math.round(tot.p)}g · C {Math.round(tot.c)}g · F {Math.round(tot.f)}g · Fibre {Math.round(tot.fb)}g</div>
            <PhotoDiary dayKey={k} compact />
            {meals.map((m, i) => (
              <div key={i} className="hist-meal">
                <div className="row gap">
                  <div className="tiny b grow">{m.icon} {m.label}{m.time ? ` · ${tm(m.time)}` : ''} {SRC[m.source] ? <span className="muted">· {SRC[m.source]}</span> : null}</div>
                </div>
                {(m.items || []).map((it, j) => (
                  <div key={j} className="item" onClick={() => open(it)}>
                    <span className="emoji">{it.emoji || '🍽️'}</span>
                    <div className="grow"><div className="small">{it.name}</div><div className="tiny muted">{it.serving}{it.qty && it.qty !== 1 ? ` × ${it.qty}` : ''}</div></div>
                    <div className="tiny right"><b>{Math.round((it.kcal || 0) * (it.qty || 1))}</b><div className="muted">P{Math.round((it.p || 0) * (it.qty || 1))}</div></div>
                  </div>
                ))}
              </div>
            ))}
          </Card>
        );
      })}
      {keys.length > limit && <Button variant="ghost" onClick={() => setLimit(limit + 14)}>Show older days</Button>}
      <div style={{ height: 110 }} />
      <Sheet open={!!pick} onClose={() => setPick(null)} title={pick ? `${pick.emoji || '🍽️'} ${pick.name}` : ''}>
        {pick && (
          <div className="col gap">
            <div className="tiny muted">{pick.serving}</div>
            <div className="nutri-grid">
              {[['kcal', Math.round((pick.kcal || 0) * (pick.qty || 1)), '#00f5a0'], ['Protein', Math.round((pick.p || 0) * (pick.qty || 1)) + 'g', '#ff6b9d'], ['Carbs', Math.round((pick.c || 0) * (pick.qty || 1)) + 'g', '#ffd166'], ['Fat', Math.round((pick.f || 0) * (pick.qty || 1)) + 'g', '#74b9ff'], ['Fibre', Math.round((pick.fb || 0) * (pick.qty || 1)) + 'g', '#7bed9f']].map(([l, v, c]) => (
                <div key={l} className="nutri" style={{ '--c': c }}><b>{v}</b><span className="tiny muted">{l}</span></div>
              ))}
            </div>
            <Story food={pick} />
            <YourPhotos food={pick} />
          </div>
        )}
      </Sheet>
    </motion.div>
  );
}

