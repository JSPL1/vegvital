import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore, updateDay, todayKey, emptyDay } from '../lib/store.js';
import { dayTotals, burned, proteinGoal, dayScore, fmtH, fmtTime } from '../lib/calc.js';
import { MEAL_SLOTS, planForDate, DAILY_RULES } from '../data/plan.js';
import { Ring, CountUp, Card, Bar, stagger, rise, WaterGlass, Sheet, Button, Pill, tap, useNow } from '../components/ui.jsx';

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

export default function Home({ go, openScan }) {
  const profile = useStore((s) => s.profile);
  const day = useStore((s) => s.days[todayKey()]) || emptyDay();
  const now = useNow();
  const [sheet, setSheet] = useState(null);
  const plan = planForDate();
  const t = dayTotals(day);
  const out = burned(day, profile.weightKg);
  const left = profile.targetKcal - t.kcal + out;
  const pGoal = proteinGoal(profile);
  const score = dayScore(day, profile);
  const nm = now.getHours() * 60 + now.getMinutes();
  const next = MEAL_SLOTS.find((s) => !day.meals[s.key] && toMin(s.end) + 30 > nm);
  const hour = now.getHours();
  const greet = hour < 5 ? 'Late night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const workStart = toMin(profile.workStart), workEnd = toMin(profile.workEnd);
  const workMins = Math.max(0, Math.min(nm, workEnd) - workStart);
  const breaksDue = Math.floor(workMins / 75);
  const rule = DAILY_RULES[now.getDate() % DAILY_RULES.length];

  const addWater = (n) => { tap(); updateDay((d) => ({ ...d, water: Math.max(0, (d.water || 0) + n) })); };

  return (
    <motion.div className="screen" variants={stagger} initial="hidden" animate="show">
      <motion.header className="top" variants={rise}>
        <div>
          <div className="muted small">{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</div>
          <h1 className="title">{greet}{profile.name ? `, ${profile.name.split(' ')[0]}` : ''} <motion.span className="wave" animate={{ rotate: [0, 18, -8, 18, 0] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.5 }}>👋</motion.span></h1>
        </div>
        <motion.button className="avatar" whileTap={{ scale: 0.9 }} onClick={() => go('settings')}>
          {profile.name ? profile.name[0].toUpperCase() : '⚙️'}
        </motion.button>
      </motion.header>

      {/* HERO */}
      <Card className="hero" glow="#00f5a0">
        <div className="hero-ring">
          <Ring size={190} stroke={16} value={t.kcal} max={profile.targetKcal + out} colors={['#00f5a0', '#00d9f5']} id="hero">
            <div className="big"><CountUp value={Math.abs(left)} /></div>
            <div className="muted small">{left >= 0 ? 'kcal left' : 'kcal over'}</div>
          </Ring>
          <motion.div className="orbit" animate={{ rotate: 360 }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}>
            <span>✦</span>
          </motion.div>
        </div>
        <div className="hero-stats">
          <div><span className="dot" style={{ background: '#00f5a0' }} />Eaten<b><CountUp value={t.kcal} /></b></div>
          <div><span className="dot" style={{ background: '#ff6b6b' }} />Burned<b><CountUp value={out} /></b></div>
          <div><span className="dot" style={{ background: '#ffd166' }} />Target<b>{profile.targetKcal}</b></div>
          <div className="score">
            <Ring size={62} stroke={6} value={score} max={100} colors={['#f6d365', '#fda085']} id="score" delay={0.3}>
              <b><CountUp value={score} /></b>
            </Ring>
            <span className="muted tiny">Day score</span>
          </div>
        </div>
      </Card>

      {/* MACROS */}
      <Card className="macros">
        {[
          ['Protein', t.p, pGoal, ['#ff6b9d', '#c44569'], 'g'],
          ['Carbs', t.c, Math.round(profile.targetKcal * 0.5 / 4), ['#ffd166', '#ff9f43'], 'g'],
          ['Fat', t.f, Math.round(profile.targetKcal * 0.27 / 9), ['#74b9ff', '#a29bfe'], 'g'],
          ['Fibre', t.fb, 30, ['#7bed9f', '#2ed573'], 'g'],
        ].map(([label, v, max, c, u], i) => (
          <div className="macro" key={label}>
            <div className="row-between"><span className="small">{label}</span><span className="tiny muted"><b className="white"><CountUp value={v} /></b>/{max}{u}</span></div>
            <Bar value={v} max={max} colors={c} delay={0.15 * i} />
          </div>
        ))}
      </Card>

      {/* NEXT MEAL */}
      {next && (
        <Card className="next" onClick={() => go('food')} glow={next.color}>
          <div className="next-icon" style={{ background: next.color + '33' }}>
            <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2 }}>{next.icon}</motion.span>
          </div>
          <div className="grow">
            <div className="tiny muted">UP NEXT · {next.time}</div>
            <div className="b">{next.label}</div>
            <div className="small muted ellipsis">{plan.meals[next.key].items.map((i) => i.name).join(' · ')}</div>
          </div>
          <div className="kcal-chip">{Math.round(plan.meals[next.key].total.kcal)}<small>kcal</small></div>
        </Card>
      )}

      {/* TILES */}
      <div className="grid2">
        <Card className="tile" onClick={() => setSheet('water')} glow="#4facfe">
          <div className="tile-head"><span>💧 Water</span><Pill color="#4facfe">{Math.round((day.water || 0) * 0.25 * 10) / 10} L</Pill></div>
          <div className="water-row">
            <WaterGlass value={day.water || 0} max={profile.waterGoal} />
            <div>
              <div className="big2"><CountUp value={day.water || 0} /><small>/{profile.waterGoal}</small></div>
              <motion.button className="plus" whileTap={{ scale: 0.8, rotate: 90 }} onClick={(e) => { e.stopPropagation(); addWater(1); }}>+</motion.button>
            </div>
          </div>
        </Card>

        <Card className="tile" onClick={() => go('move')} glow="#f093fb">
          <div className="tile-head"><span>👟 Steps</span><Pill color="#f093fb">{day.stepsSource === 'Health Connect' ? 'auto' : 'sensor'}</Pill></div>
          <Ring size={96} stroke={10} value={day.steps || 0} max={profile.stepGoal} colors={['#f093fb', '#f5576c']} id="steps" delay={0.2}>
            <b><CountUp value={day.steps || 0} /></b>
            <span className="tiny muted">/{profile.stepGoal / 1000}k</span>
          </Ring>
        </Card>

        <Card className="tile" onClick={() => setSheet('sleep')} glow="#667eea">
          <div className="tile-head"><span>😴 Sleep</span>{day.sleep && <Pill color="#a29bfe">auto</Pill>}</div>
          <div className="moon-wrap">
            <motion.div className="moon" animate={{ rotate: [-8, 8, -8] }} transition={{ duration: 6, repeat: Infinity }}>🌙</motion.div>
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="zzz" initial={{ opacity: 0, y: 0, x: 0 }} animate={{ opacity: [0, 1, 0], y: -26, x: 12 }} transition={{ duration: 2.4, delay: i * 0.8, repeat: Infinity }}>z</motion.span>
            ))}
          </div>
          <div className="big2">{day.sleep ? fmtH(day.sleep.mins) : '—'}</div>
          <div className="tiny muted">{day.sleep ? `${fmtTime(day.sleep.start)} → ${fmtTime(day.sleep.end)}` : 'Detected automatically'}</div>
        </Card>

        <Card className="tile" onClick={() => setSheet('work')} glow="#43e97b">
          <div className="tile-head"><span>💻 Work</span><Pill color="#43e97b">{day.breaks || 0}/{Math.max(breaksDue, 1)} breaks</Pill></div>
          <div className="big2">{fmtH(workMins)}</div>
          <div className="tiny muted">{profile.workStart}–{profile.workEnd}</div>
          <Bar value={workMins} max={workEnd - workStart} colors={['#43e97b', '#38f9d7']} delay={0.3} />
          <div className="tiny muted" style={{ marginTop: 6 }}>{breaksDue > (day.breaks || 0) ? '⚠️ Time to stand & stretch' : '✅ Posture on track'}</div>
        </Card>
      </div>

      {/* TIMELINE */}
      <Card className="timeline">
        <div className="row-between"><h3>Today’s meals</h3><span className="tiny muted">auto-logged from plan</span></div>
        {MEAL_SLOTS.map((s, i) => {
          const logged = day.meals[s.key];
          const items = logged?.items || plan.meals[s.key].items;
          const kcal = items.reduce((a, x) => a + x.kcal * (x.qty || 1), 0);
          return (
            <motion.div key={s.key} className={`tl-row ${logged ? 'done' : ''}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
              <div className="tl-dot" style={{ '--c': s.color }}>{logged ? '✓' : ''}</div>
              <div className="grow">
                <div className="row-between"><b className="small">{s.icon} {s.label}</b><span className="tiny muted">{s.time}</span></div>
                <div className="tiny muted ellipsis">{items.map((x) => x.name).join(', ')}</div>
              </div>
              <div className="tiny b">{Math.round(kcal)}</div>
              {logged?.source === 'photo' && <span className="tiny">📸</span>}
            </motion.div>
          );
        })}
        <Button className="full" onClick={openScan}>📸 Ate something else? Snap it</Button>
      </Card>

      <Card className="tip">
        <motion.div className="tip-icon" animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 2.5 }}>{rule.icon}</motion.div>
        <div><div className="tiny muted">TODAY’S HABIT</div><div className="small">{rule.text}</div></div>
      </Card>

      <div style={{ height: 110 }} />

      <Sheet open={sheet === 'water'} onClose={() => setSheet(null)} title="💧 Hydration">
        <div className="center col">
          <div style={{ width: 140 }}><WaterGlass value={day.water || 0} max={profile.waterGoal} /></div>
          <div className="big"><CountUp value={day.water || 0} /> <small className="muted">/ {profile.waterGoal} glasses</small></div>
          <div className="row gap">
            <Button variant="ghost" onClick={() => addWater(-1)}>−1</Button>
            <Button onClick={() => addWater(1)}>+1 glass (250 ml)</Button>
          </div>
          <p className="muted small center-text">You’ll get a gentle reminder every 90 minutes. Minimum 2 litres a day.</p>
        </div>
      </Sheet>

      <Sheet open={sheet === 'sleep'} onClose={() => setSheet(null)} title="😴 Sleep">
        <SleepSheet day={day} profile={profile} />
      </Sheet>

      <Sheet open={sheet === 'work'} onClose={() => setSheet(null)} title="💻 Work wellness">
        <div className="col gap">
          <p className="small muted">Work hours {profile.workStart}–{profile.workEnd}. A stand-up reminder arrives every 75 minutes. Completing a Desk Break Reset counts automatically.</p>
          <div className="row-between"><span>Breaks taken</span><b>{day.breaks || 0} / {Math.max(breaksDue, 1)}</b></div>
          <Bar value={day.breaks || 0} max={Math.max(breaksDue, 1)} colors={['#43e97b', '#38f9d7']} />
          <ul className="list small">
            <li>👀 20-20-20 rule: every 20 min look 20 ft away for 20 s</li>
            <li>🪑 Feet flat, screen at eye level, elbows 90°</li>
            <li>💧 Keep a bottle on your desk</li>
            <li>🥜 Desk snack: makhana, roasted chana, fruit — not biscuits</li>
            <li>🚶 Take calls standing or walking</li>
          </ul>
          <Button className="full" onClick={() => { setSheet(null); go('move', 'desk'); }}>Start 5-min Desk Break ▶</Button>
        </div>
      </Sheet>
    </motion.div>
  );
}

function SleepSheet({ day, profile }) {
  const s = day.sleep;
  const set = (patch) => updateDay((d) => ({ ...d, sleep: { ...(d.sleep || {}), ...patch } }));
  const quality = s ? Math.min(100, Math.round((s.mins / 60 / profile.sleepGoalH) * 100)) : 0;
  return (
    <div className="col gap">
      {s ? (
        <>
          <div className="center">
            <Ring size={150} stroke={14} value={s.mins} max={profile.sleepGoalH * 60} colors={['#667eea', '#764ba2']} id="sleepbig">
              <div className="big2">{fmtH(s.mins)}</div>
              <div className="tiny muted">{quality}% of goal</div>
            </Ring>
          </div>
          <div className="row-between small"><span>🛏️ Fell asleep</span><b>{fmtTime(s.start)}</b></div>
          <div className="row-between small"><span>⏰ Woke up</span><b>{fmtTime(s.end)}</b></div>
          <div className="row-between small"><span>Source</span><span className="muted">{s.source}</span></div>
          {s.stages && Object.keys(s.stages).length > 0 && (
            <div className="stages">
              {Object.entries(s.stages).map(([k, v]) => (
                <div key={k} className="row-between tiny"><span>{k}</span><span>{fmtH(v)}</span></div>
              ))}
            </div>
          )}
          <div className="tiny muted">Wrong? Nudge it:</div>
          <div className="row gap wrap">
            <Button variant="ghost" onClick={() => set({ mins: s.mins - 30, source: 'adjusted' })}>−30m</Button>
            <Button variant="ghost" onClick={() => set({ mins: s.mins + 30, source: 'adjusted' })}>+30m</Button>
          </div>
        </>
      ) : (
        <p className="muted small">Sleep is detected automatically from Health Connect (phone/watch) or, if not available, from when you stop and start using your phone overnight. Nothing to enter.</p>
      )}
      <ul className="list small">
        <li>🎯 Goal {profile.sleepGoalH} h · bed {profile.bed} · wake {profile.wake}</li>
        <li>📵 Screens off 30 min before bed</li>
        <li>🥛 Haldi doodh at 22:00 is already in your plan</li>
      </ul>
    </div>
  );
}
