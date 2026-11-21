import { motion } from 'framer-motion';

// Animated exercise demonstrator. Angles in degrees; for a limb hanging down,
// positive = swings to screen-left, negative = swings to screen-right.
// Each pose is a list of keyframes the figure loops through.
const P = (o) => ({ aL: 15, aR: -15, lL: 6, lR: -6, y: 0, x: 0, rot: 0, head: 0, chest: 1, ...o });

const POSES = {
  march: [P({ aL: 40, aR: -10, lL: 0, lR: -55 }), P({ aL: 10, aR: -40, lL: 55, lR: 0 })],
  jack: [P({ aL: 15, aR: -15, lL: 6, lR: -6 }), P({ aL: 165, aR: -165, lL: 28, lR: -28, y: -6 })],
  squat: [P({ aL: 20, aR: -20 }), P({ aL: 95, aR: -95, lL: 38, lR: -38, y: 16 })],
  lunge: [P({ lL: 30, lR: -18, y: 10, aL: 25, aR: -25 }), P({ lL: 18, lR: -30, y: 10, aL: 25, aR: -25 }), P({})],
  armcircle: [P({ aL: 75, aR: -75 }), P({ aL: 105, aR: -105 })],
  sidebend: [P({ rot: -16, aL: 10, aR: -170 }), P({ rot: 16, aL: 170, aR: -10 })],
  twist: [P({ aL: 90, aR: -40 }), P({ aL: 40, aR: -90 })],
  neck: [P({ head: -4 }), P({ head: 4 })],
  calf: [P({}), P({ y: -7, aL: 25, aR: -25 })],
  tree: [P({ aL: 172, aR: -172, lL: 0, lR: -70, rot: -2 }), P({ aL: 168, aR: -168, lL: 0, lR: -70, rot: 2 })],
  breathe: [P({ aL: 25, aR: -25, chest: 0.94 }), P({ aL: 40, aR: -40, chest: 1.1 })],
  surya: [P({ aL: 175, aR: -175 }), P({ aL: 175, aR: -175, rot: -12 }), P({ aL: 20, aR: -20, rot: 80, y: 4 }), P({})],
  burpee: [P({}), P({ aL: 95, aR: -95, lL: 38, lR: -38, y: 16 }), P({ aL: 170, aR: -170, y: -8 })],
  // floor poses: whole body rotated
  pushup: [P({ rot: 72, y: 22, aL: -72, aR: -72, lL: 0, lR: 0 }), P({ rot: 78, y: 30, aL: -40, aR: -40, lL: 0, lR: 0 })],
  plank: [P({ rot: 76, y: 28, aL: -76, aR: -76, lL: 0, lR: 0, chest: 1 }), P({ rot: 76, y: 28, aL: -76, aR: -76, lL: 4, lR: -4, chest: 1.04 })],
  cobra: [P({ rot: 60, y: 30, aL: -60, aR: -60, lL: 30, lR: 30 }), P({ rot: 45, y: 26, aL: -45, aR: -45, lL: 45, lR: 45 })],
  child: [P({ rot: -95, y: 30, aL: 170, aR: 170, lL: -80, lR: -80, chest: 0.96 }), P({ rot: -95, y: 30, aL: 170, aR: 170, lL: -80, lR: -80, chest: 1.05 })],
  bridge: [P({ rot: -90, y: 34, aL: 90, aR: 90, lL: -60, lR: -60 }), P({ rot: -70, y: 26, aL: 70, aR: 70, lL: -90, lR: -90 })],
  forward: [P({ rot: 70, y: 6, aL: -60, aR: -60 }), P({ rot: 85, y: 8, aL: -80, aR: -80 })],
};

const origin = (x, y) => ({ transformOrigin: `${x}px ${y}px`, transformBox: 'view-box' });

export default function Figure({ pose = 'march', fast, size = 180, color = '#00f5a0', paused }) {
  const frames = POSES[pose] || POSES.march;
  const k = (key) => [...frames.map((f) => f[key]), frames[0][key]];
  const dur = (fast ? 0.7 : 1.6) * frames.length * 0.6;
  const t = { duration: dur, repeat: paused ? 0 : Infinity, ease: 'easeInOut' };
  const a = (key) => (paused ? { rotate: frames[0][key] } : { rotate: k(key) });

  return (
    <svg viewBox="0 0 100 130" width={size} height={size * 1.3} className="figure">
      <defs>
        <radialGradient id="figGlow"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></radialGradient>
      </defs>
      <motion.ellipse cx="50" cy="122" rx="28" ry="4" fill="rgba(255,255,255,.08)"
        animate={paused ? {} : { rx: [28, 22, 28] }} transition={t} />
      {pose === 'breathe' && (
        <motion.circle cx="50" cy="55" r="40" fill="url(#figGlow)"
          animate={{ scale: [0.7, 1.15, 0.7] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} style={origin(50, 55)} />
      )}
      <motion.g animate={paused ? {} : { y: k('y'), x: k('x') }} transition={t}>
        <motion.g animate={a('rot')} transition={t} style={origin(50, 78)}>
          {/* legs from hip (50,78) */}
          <motion.g animate={a('lL')} transition={t} style={origin(47, 78)}>
            <line x1="47" y1="78" x2="47" y2="118" className="limb" stroke={color} />
          </motion.g>
          <motion.g animate={a('lR')} transition={t} style={origin(53, 78)}>
            <line x1="53" y1="78" x2="53" y2="118" className="limb" stroke={color} />
          </motion.g>
          {/* torso */}
          <motion.g animate={paused ? {} : { scaleX: k('chest') }} transition={t} style={origin(50, 60)}>
            <line x1="50" y1="42" x2="50" y2="78" className="limb torso" stroke={color} />
          </motion.g>
          {/* arms from shoulder (50,44) */}
          <motion.g animate={a('aL')} transition={t} style={origin(48, 45)}>
            <line x1="48" y1="45" x2="48" y2="75" className="limb" stroke={color} />
          </motion.g>
          <motion.g animate={a('aR')} transition={t} style={origin(52, 45)}>
            <line x1="52" y1="45" x2="52" y2="75" className="limb" stroke={color} />
          </motion.g>
          {/* head */}
          <motion.circle cx="50" cy="31" r="8.5" fill={color} className="head"
            animate={paused ? {} : { cx: k('head').map((h) => 50 + h) }} transition={t} />
        </motion.g>
      </motion.g>
    </svg>
  );
}
