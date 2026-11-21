import { useEffect, useState } from 'react';
import { motion, AnimatePresence, animate, useMotionValue, useTransform } from 'framer-motion';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export const tap = () => { try { Haptics.impact({ style: ImpactStyle.Light }); } catch { /* web */ } };

export function CountUp({ value, decimals = 0, duration = 1.1, suffix = '' }) {
  const mv = useMotionValue(0);
  const [text, setText] = useState('0');
  useEffect(() => {
    const c = animate(mv, value || 0, { duration, ease: [0.16, 1, 0.3, 1] });
    const unsub = mv.on('change', (v) => setText(v.toFixed(decimals)));
    return () => { c.stop(); unsub(); };
  }, [value]);
  return <>{Number(text).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>;
}

/** Animated gradient progress ring */
export function Ring({ size = 120, stroke = 12, value = 0, max = 1, colors = ['#00f5a0', '#00d9f5'], children, id, track = 'rgba(255,255,255,.08)', delay = 0 }) {
  const r = (size - stroke) / 2;
  const pct = Math.max(0, Math.min(1.0001, max ? value / max : 0));
  const gid = `g-${id || colors.join('').replace(/#/g, '')}`;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} />
          </linearGradient>
          <filter id={`${gid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={`url(#${gid})`} strokeWidth={stroke} strokeLinecap="round"
          filter={`url(#${gid}-glow)`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: Math.min(pct, 1) }}
          transition={{ duration: 1.4, delay, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function Bar({ value, max, colors = ['#00f5a0', '#00d9f5'], height = 8, delay = 0 }) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div className="bar" style={{ height }}>
      <motion.div
        className="bar-fill"
        style={{ background: `linear-gradient(90deg, ${colors[0]}, ${colors[1]})` }}
        initial={{ width: 0 }}
        animate={{ width: `${pct * 100}%` }}
        transition={{ duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
export const rise = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

export function Card({ children, className = '', onClick, style, glow }) {
  return (
    <motion.div
      variants={rise}
      className={`card ${className} ${onClick ? 'clickable' : ''}`}
      style={{ ...style, ...(glow ? { '--glow': glow } : {}) }}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      onClick={onClick ? () => { tap(); onClick(); } : undefined}
    >
      {children}
    </motion.div>
  );
}

export function Sheet({ open, onClose, children, title }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="sheet"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => { if (i.offset.y > 120 || i.velocity.y > 600) onClose(); }}
          >
            <div className="sheet-handle" />
            {title && <h2 className="sheet-title">{title}</h2>}
            <div className="sheet-body">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function Pill({ children, color = '#00f5a0' }) {
  return <span className="pill" style={{ '--c': color }}>{children}</span>;
}

export function Button({ children, onClick, variant = 'primary', className = '', disabled, style }) {
  return (
    <motion.button
      className={`btn btn-${variant} ${className}`}
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      disabled={disabled}
      style={style}
      onClick={(e) => { tap(); onClick?.(e); }}
    >
      {children}
    </motion.button>
  );
}

export function Toast({ msg }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div className="toast" initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -80, opacity: 0 }}>
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Water glass that fills with a wavy animation */
export function WaterGlass({ value, max }) {
  const pct = Math.min(1, value / max);
  const y = 110 - pct * 100;
  return (
    <svg viewBox="0 0 80 120" className="glass">
      <defs>
        <clipPath id="glassClip"><path d="M8 6 L72 6 L64 114 L16 114 Z" /></clipPath>
        <linearGradient id="waterG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4facfe" /><stop offset="1" stopColor="#00f2fe" />
        </linearGradient>
      </defs>
      <g clipPath="url(#glassClip)">
        <motion.g initial={{ y: 110 }} animate={{ y }} transition={{ type: 'spring', stiffness: 60, damping: 14 }}>
          <motion.path
            d="M-80 0 Q -60 -8 -40 0 T 0 0 T 40 0 T 80 0 T 120 0 T 160 0 V 130 H -80 Z"
            fill="url(#waterG)" opacity="0.9"
            animate={{ x: [0, 80] }} transition={{ repeat: Infinity, duration: 2.4, ease: 'linear' }}
          />
          <motion.path
            d="M-80 3 Q -60 -5 -40 3 T 0 3 T 40 3 T 80 3 T 120 3 T 160 3 V 130 H -80 Z"
            fill="#ffffff" opacity="0.18"
            animate={{ x: [80, 0] }} transition={{ repeat: Infinity, duration: 3.2, ease: 'linear' }}
          />
        </motion.g>
      </g>
      <path d="M8 6 L72 6 L64 114 L16 114 Z" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export function Sparkline({ data, color = '#00f5a0', height = 40 }) {
  const w = 120;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => [(i / Math.max(1, data.length - 1)) * w, height - (v / max) * (height - 4) - 2]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="spark" preserveAspectRatio="none">
      <motion.path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
    </svg>
  );
}

export function useNow(ms = 30000) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export { motion, AnimatePresence, useTransform };
