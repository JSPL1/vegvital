import { useState } from 'react';
import { motion } from 'framer-motion';
import { useStore, todayKey } from '../lib/store.js';
import { importGalleryPhotos, processPending } from '../lib/pending.js';
import { usePhoto, deleteDiary } from '../lib/photos.js';
import { MEAL_SLOTS } from '../data/plan.js';
import { Card, Sheet, Button, tap } from './ui.jsx';
import { fmtTime } from '../lib/calc.js';

const BADGE = { done: '✅', logged: '✅', waiting: '⏳', notfood: '🚫' };

function Thumb({ p, onOpen }) {
  const src = usePhoto(p.id);
  return (
    <motion.button className="pd-thumb" whileTap={{ scale: 0.92 }} onClick={() => { tap(); onOpen(p); }}>
      {src ? <img src={src} alt="" /> : <span className="pd-ph">🍽</span>}
      <i className={`pd-badge ${p.status}`}>{BADGE[p.status] || '⏳'}</i>
      <small>{p.kcal ? `${p.kcal} kcal` : MEAL_SLOTS.find((s) => s.key === p.slot)?.label}</small>
    </motion.button>
  );
}

/** Today's food photos, stored in the app. "Add photos" bulk-imports from the gallery. */
export default function PhotoDiary({ dayKey = todayKey(), toast, compact }) {
  const list = useStore((s) => (s.photos || {})[dayKey]) || [];
  const waiting = useStore((s) => (s.pending || []).filter((p) => p.photoId).length);
  const lastErr = useStore((s) => (s.pending || []).find((p) => p.lastErr)?.lastErr);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const big = usePhoto(open?.id);

  async function add() {
    tap(); setBusy(true);
    try {
      const n = await importGalleryPhotos();
      if (n) toast?.(`📥 ${n} photo${n > 1 ? 's' : ''} saved · the AI reads them one by one`);
    } catch (e) {
      if (!String(e?.message || e).toLowerCase().includes('cancel')) toast?.('Could not add photos: ' + String(e?.message || e).slice(0, 60));
    }
    setBusy(false);
  }

  if (compact && !list.length) return null;
  return (
    <>
    <Card className="photo-diary">
      <div className="row-between">
        <h3>📷 Food photos</h3>
        {!compact && <button className="chipbtn on" disabled={busy} onClick={add}>{busy ? 'Saving…' : '＋ Add photos'}</button>}
      </div>
      {list.length ? (
        <div className="pd-strip">{list.map((p) => <Thumb key={p.id} p={p} onOpen={setOpen} />)}</div>
      ) : (
        <p className="tiny muted">Every photo you snap is saved here. Took pictures with the phone camera? Tap <b>＋ Add photos</b> and pick them all at once — the app files them under the right meal and the AI counts them automatically.</p>
      )}
      {!compact && waiting > 0 && (
        <div className="tiny muted pd-wait">
          ⏳ {waiting} photo{waiting > 1 ? 's' : ''} waiting for the AI — checked every few minutes.{' '}
          <button className="link tiny" onClick={() => { tap(); processPending(); }}>Check now</button>
          {lastErr && <div className="tiny" style={{ opacity: 0.7 }}>Last reply: {lastErr}</div>}
        </div>
      )}
    </Card>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name || 'Food photo'}>
        {open && (
          <div className="col gap">
            {big && <img src={big} alt="" className="pd-big" />}
            <div className="small">
              {MEAL_SLOTS.find((s) => s.key === open.slot)?.icon} {MEAL_SLOTS.find((s) => s.key === open.slot)?.label} · {fmtTime(open.time)}
              {open.kcal ? ` · ${open.kcal} kcal` : ''}
            </div>
            <div className="tiny muted">
              {open.status === 'waiting' ? '⏳ Waiting for the AI — it will be counted automatically.' : open.status === 'notfood' ? '🚫 The AI found no food in this photo.' : '✅ Counted in your day.'}
            </div>
            <Button variant="ghost" onClick={async () => { await deleteDiary(open.id); setOpen(null); }}>🗑 Remove photo</Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
