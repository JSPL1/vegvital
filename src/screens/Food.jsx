import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore, updateDay, todayKey, emptyDay } from '../lib/store.js';
import { FOODS, CATEGORIES, healthScore, sumNutrition, findFood } from '../data/foods.js';
import { usePhoto } from '../lib/photos.js';
import { pullAll } from '../lib/cloud.js';
import PhotoDiary from '../components/PhotoDiary.jsx';
import { useEffect } from 'react';
import { MEAL_SLOTS, planForDate, DAILY_RULES } from '../data/plan.js';
import { GUIDE } from '../data/guide.js';
import { Card, stagger, rise, Sheet, Button, Pill, tap } from '../components/ui.jsx';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Food({ openScan }) {
  const [tab, setTab] = useState('plan');
  return (
    <motion.div className="screen" variants={stagger} initial="hidden" animate="show">
      <motion.header className="top" variants={rise}>
        <h1 className="title">Food</h1>
        <Pill color="#2ed573">🌱 100% Veg</Pill>
      </motion.header>
      <motion.div className="seg" variants={rise}>
        {[['plan', 'Plan'], ['chart', 'Foods'], ['history', 'History'], ['guide', 'Eating out']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => { tap(); setTab(k); }}>
            {tab === k && <motion.div layoutId="segpill" className="seg-pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <span>{l}</span>
          </button>
        ))}
      </motion.div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
          {tab === 'plan' && <Plan openScan={openScan} />}
          {tab === 'chart' && <Chart />}
          {tab === 'history' && <History />}
          {tab === 'guide' && <Guide />}
        </motion.div>
      </AnimatePresence>
      <div style={{ height: 110 }} />
    </motion.div>
  );
}

function Plan({ openScan }) {
  const today = new Date();
  const [dow, setDow] = useState(today.getDay());
  const date = new Date(today); date.setDate(today.getDate() + ((dow - today.getDay() + 7) % 7));
  const plan = planForDate(date);
  const isToday = dow === today.getDay();
  const day = useStore((s) => s.days[todayKey()]) || emptyDay();

  const markEaten = (slot, eaten) => {
    tap();
    updateDay((d) => {
      const meals = { ...d.meals };
      if (eaten) meals[slot] = { items: plan.meals[slot].items, source: 'plan', time: new Date().toISOString() };
      else delete meals[slot];
      return { ...d, meals };
    });
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <div className="days">
        {DAYS.map((d, i) => (
          <motion.button key={d} whileTap={{ scale: 0.9 }} className={`daybtn ${dow === i ? 'on' : ''} ${today.getDay() === i ? 'today' : ''}`} onClick={() => { tap(); setDow(i); }}>
            {dow === i && <motion.div layoutId="daypill" className="day-pill" />}
            <span>{d}</span>
          </motion.button>
        ))}
      </div>
      <Card className="plan-total">
        <div><div className="tiny muted">PLANNED</div><div className="big2">{Math.round(plan.total.kcal)} <small>kcal</small></div></div>
        <div className="macro-chips">
          <span className="chip p">P {Math.round(plan.total.p)}g</span>
          <span className="chip c">C {Math.round(plan.total.c)}g</span>
          <span className="chip f">F {Math.round(plan.total.f)}g</span>
          <span className="chip fb">Fb {Math.round(plan.total.fb)}g</span>
        </div>
      </Card>
      {plan.swapNote && <Card className="swap"><span>🔄</span><span className="small">Veg swap: {plan.swapNote}</span></Card>}
      {MEAL_SLOTS.map((s) => {
        const m = plan.meals[s.key];
        const logged = isToday && day.meals[s.key];
        const shown = logged ? logged.items : m.items;
        const tot = sumNutrition(shown);
        return (
          <Card key={s.key} className={`meal ${logged ? 'eaten' : ''}`} glow={s.color}>
            <div className="meal-head">
              <div className="meal-icon" style={{ background: s.color + '2a' }}>{s.icon}</div>
              <div className="grow">
                <div className="b">{s.label}</div>
                <div className="tiny muted">{s.time} – {s.end}{logged ? ` · ${logged.source === 'photo' ? '📸 photo' : logged.source === 'plan-auto' ? 'auto' : 'logged'}` : ''}</div>
              </div>
              <div className="kcal-chip">{Math.round(tot.kcal)}<small>kcal</small></div>
            </div>
            <div className="items">
              {shown.map((it, i) => (
                <motion.div key={i} className="item" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <span className="emoji">{it.emoji}</span>
                  <div className="grow"><div className="small">{it.name}</div><div className="tiny muted">{it.serving}</div></div>
                  <div className="tiny right"><b>{Math.round(it.kcal * (it.qty || 1))}</b><div className="muted">P{Math.round(it.p * (it.qty || 1))}</div></div>
                </motion.div>
              ))}
            </div>
            {isToday && (
              <div className="row gap">
                {logged ? (
                  <Button variant="ghost" onClick={() => markEaten(s.key, false)}>↺ Undo</Button>
                ) : (
                  <Button onClick={() => markEaten(s.key, true)}>✓ Ate as planned</Button>
                )}
                <Button variant="ghost" onClick={() => openScan(s.key)}>📸 Different</Button>
              </div>
            )}
          </Card>
        );
      })}
      <Card>
        <h3>Daily guidelines</h3>
        <ul className="list small">{DAILY_RULES.map((r) => <li key={r.text}>{r.icon} {r.text}</li>)}</ul>
      </Card>
    </motion.div>
  );
}

function Chart() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [pick, setPick] = useState(null);
  const list = useMemo(() => FOODS
    .filter((f) => (cat === 'All' || f.cat === cat) && (f.name + ' ' + (f.region || '')).toLowerCase().includes(q.toLowerCase()))
    .map((f) => ({ ...f, score: healthScore(f, f.tags) }))
    .sort((a, b) => b.score - a.score), [q, cat]);

  const add = (slot) => {
    updateDay((d) => {
      const meals = { ...d.meals };
      const prev = meals[slot]?.source === 'plan-auto' ? [] : (meals[slot]?.items || []);
      meals[slot] = { items: [...prev, { ...pick, qty: 1 }], source: 'manual', time: new Date().toISOString() };
      return { ...d, meals };
    });
    setPick(null);
  };

  return (
    <div>
      <div className="search"><span>🔎</span><input placeholder={`Search ${FOODS.length} Indian veg foods, e.g. idli, Odisha…`} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="chips-scroll">
        {['All', 'Odisha', 'Street food', 'Breakfast', 'Meals', ...CATEGORIES.filter((c) => !['Odisha', 'Street food', 'Breakfast', 'Meals'].includes(c))].map((c) => (
          <motion.button key={c} whileTap={{ scale: 0.9 }} className={`chipbtn ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</motion.button>
        ))}
      </div>
      <motion.div layout className="food-list">
        <AnimatePresence>
          {list.map((f) => (
            <motion.div layout key={f.id} className="food-row" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} whileTap={{ scale: 0.97 }} onClick={() => { tap(); setPick(f); }}>
              <span className="emoji big-emoji">{f.emoji}</span>
              <div className="grow">
                <div className="small b">{f.name}</div>
                <div className="tiny muted">{f.region ? `📍 ${f.region} · ` : ''}{f.serving} · P{f.p} C{f.c} F{f.f}</div>
              </div>
              <div className="right">
                <div className="b">{f.kcal}</div>
                <div className={`score-badge s${f.score >= 8 ? 'hi' : f.score >= 5 ? 'mid' : 'lo'}`}>{f.score}/10</div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      <Sheet open={!!pick} onClose={() => setPick(null)} title={pick ? `${pick.emoji} ${pick.name}` : ''}>
        {pick && (
          <div className="col gap">
            <div className="tiny muted">{pick.serving}</div>
            <div className="nutri-grid">
              {[['kcal', pick.kcal, '#00f5a0'], ['Protein', pick.p + 'g', '#ff6b9d'], ['Carbs', pick.c + 'g', '#ffd166'], ['Fat', pick.f + 'g', '#74b9ff'], ['Fibre', pick.fb + 'g', '#7bed9f'], ['Score', pick.score + '/10', '#fda085']].map(([l, v, c]) => (
                <motion.div key={l} className="nutri" style={{ '--c': c }} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                  <b>{v}</b><span className="tiny muted">{l}</span>
                </motion.div>
              ))}
            </div>
            {pick.tags?.length > 0 && <div className="tiny warn">⚠️ {pick.tags.join(', ')} — have occasionally</div>}
            <Story food={pick} />
            <YourPhotos food={pick} />
            <div className="tiny muted">Add to today:</div>
            <div className="row gap wrap">
              {MEAL_SLOTS.map((s) => <Button key={s.key} variant="ghost" onClick={() => add(s.key)}>{s.icon} {s.label}</Button>)}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Story({ food }) {
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
function YourPhotos({ food }) {
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

function History() {
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

  if (!keys.length) return <Card><div className="small muted">Nothing logged yet. Every meal you log or photograph will show here, date by date.</div></Card>;
  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <Card className="plan-total">
        <div><div className="tiny muted">DAYS LOGGED</div><div className="big2">{keys.length}</div></div>
        <div className="tiny muted right">Since<br /><b>{fmt(keys[keys.length - 1])}</b></div>
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

function Guide() {
  const [open, setOpen] = useState(0);
  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <Card className="guide-hero">
        <div className="big-emoji">🧳</div>
        <div><b>Travelling or eating out?</b><div className="small muted">You don’t need a perfect meal — just a good decision at each meal.</div></div>
      </Card>
      {GUIDE.map((g, i) => (
        <Card key={g.title} className="guide" onClick={() => setOpen(open === i ? -1 : i)}>
          <div className="row-between"><b>{g.icon} {g.title}</b><motion.span animate={{ rotate: open === i ? 180 : 0 }}>⌄</motion.span></div>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                {g.points && <ul className="list small">{g.points.map((p) => <li key={p}>{p}</li>)}</ul>}
                {g.good && (
                  <div className="traffic">
                    <div><div className="tiny g">✅ Choose often</div>{g.good.map((x) => <div key={x} className="small">{x}</div>)}</div>
                    <div><div className="tiny y">🟡 Sometimes</div>{g.sometimes.map((x) => <div key={x} className="small">{x}</div>)}</div>
                    <div><div className="tiny r">🔴 Limit</div>{g.limit.map((x) => <div key={x} className="small">{x}</div>)}</div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      ))}
    </motion.div>
  );
}
