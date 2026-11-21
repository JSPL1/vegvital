import { useEffect, useMemo, useRef, useState } from 'react';

/*
 * Professional exercise demonstrator.
 * A jointed figure (torso, head, upper/lower arms, thighs, shins, feet) driven by
 * forward kinematics. Each pose is a list of keyframes; we interpolate joint angles
 * with smooth easing, keep the figure on the floor automatically, and report the
 * current phase ("Down", "Up", "Inhale"…) and completed reps.
 *
 * Angles: limbs are measured from straight-down, positive = forward (screen-right).
 * Torso `t` is measured from straight-up, positive = leaning forward.
 * Side view faces right. "A" = near side (bright), "B" = far side (dim).
 */

const L = { torso: 50, neck: 7, head: 11, ua: 27, fa: 25, th: 36, sh: 35, foot: 11 };
const W = { th: 14, sh: 12, ua: 10, fa: 8.5, torso: 22 };
const GROUND = 186;

const S = (o) => ({ t: 0, aA: 0, fA: 0, aB: 0, fB: 0, tA: 0, sA: 0, tB: 0, sB: 0, lift: 0, tilt: 0, ...o });

// ---------- reusable poses ----------
const stand = S({ aA: 4, fA: 8, aB: -4, fB: 4 });
const standFront = S({ aA: 9, fA: 6, aB: -9, fB: -6, tA: 3, sA: 3, tB: -3, sB: -3 });
const squat = S({ t: 38, aA: 88, fA: 88, aB: 84, fB: 84, tA: 82, sA: -22, tB: 78, sB: -20 });
const plankHigh = S({ t: 78, aA: 2, fA: 2, aB: -2, fB: -2, tA: -78, sA: -78, tB: -76, sB: -76 });
const pushDown = S({ t: 86, aA: -118, fA: 38, aB: -114, fB: 36, tA: -86, sA: -86, tB: -85, sB: -85 });
const plankFore = S({ t: 80, aA: 4, fA: 92, aB: 0, fB: 90, tA: -80, sA: -80, tB: -79, sB: -79 });
const fold = S({ t: 128, aA: 12, fA: 6, aB: 8, fB: 4 });
const cobra = S({ t: 58, aA: -6, fA: 0, aB: -8, fB: -2, tA: -90, sA: -90, tB: -89, sB: -89 });
const dog = S({ t: 138, aA: 150, fA: 150, aB: 148, fB: 148, tA: -32, sA: -32, tB: -30, sB: -30 });
const child = S({ t: 104, aA: 100, fA: 93, aB: 98, fB: 92, tA: 74, sA: -94, tB: 72, sB: -94, tilt: 14 });
const armsUp = S({ t: -6, aA: 172, fA: 176, aB: 168, fB: 172 });

// mirror helper for alternating sides (swap near/far limbs)
const mirror = (p) => ({ ...p, aA: p.aB, fA: p.fB, aB: p.aA, fB: p.fA, tA: p.tB, sA: p.sB, tB: p.tA, sB: p.sA });

export const POSES = {
  squat: { view: 'side', dur: 1.3, frames: [[stand, 'Stand tall'], [squat, '⬇ Sit back & down']] },
  pushup: { view: 'side', dur: 1.1, frames: [[plankHigh, '⬆ Push up'], [pushDown, '⬇ Lower chest']] },
  plank: { view: 'side', dur: 2.2, frames: [[plankFore, 'Hold — body straight'], [{ ...plankFore, t: 81, tA: -81, sA: -81, tB: -80, sB: -80 }, 'Breathe steadily']] },
  lunge: {
    view: 'side', dur: 1.2, frames: [
      [stand, 'Stand tall'],
      [S({ aA: -20, fA: -10, aB: 20, fB: 30, tA: 84, sA: 2, tB: -24, sB: -96 }), '⬇ Step & drop back knee'],
      [stand, 'Push back up'],
      [S({ aA: 20, fA: 30, aB: -20, fB: -10, tB: 84, sB: 2, tA: -24, sA: -96 }), '⬇ Other leg'],
    ],
  },
  march: {
    view: 'side', dur: 0.75, frames: [
      [S({ aA: -38, fA: -10, aB: 48, fB: 110, tA: 78, sA: 2, tB: -4, sB: -4 }), 'Left knee up'],
      [S({ aB: -38, fB: -10, aA: 48, fA: 110, tB: 78, sB: 2, tA: -4, sA: -4 }), 'Right knee up'],
    ],
  },
  walk: {
    view: 'side', dur: 0.55, frames: [
      [S({ t: 3, aA: -28, fA: -10, aB: 28, fB: 55, tA: 24, sA: 6, tB: -18, sB: -38 }), 'Brisk stride'],
      [S({ t: 3, aB: -28, fB: -10, aA: 28, fA: 55, tB: 24, sB: 6, tA: -18, sA: -38 }), 'Swing arms'],
    ],
  },
  jack: {
    view: 'front', dur: 0.55, frames: [
      [standFront, 'Feet together'],
      [S({ aA: 158, fA: 170, aB: -158, fB: -170, tA: 22, sA: 22, tB: -22, sB: -22, lift: 8 }), 'Jump out, arms up'],
    ],
  },
  armcircle: {
    view: 'front', dur: 0.5, frames: [
      [S({ aA: 82, fA: 82, aB: -82, fB: -82, tA: 4, sA: 4, tB: -4, sB: -4 }), 'Small circles'],
      [S({ aA: 98, fA: 104, aB: -98, fB: -104, tA: 4, sA: 4, tB: -4, sB: -4 }), 'Arms long'],
    ],
  },
  sidebend: {
    view: 'front', dur: 1.5, frames: [
      [S({ t: 16, aA: 6, fA: 4, aB: -168, fB: 150, tA: 8, sA: 8, tB: -8, sB: -8 }), 'Reach over to the right'],
      [S({ t: -16, aA: 168, fA: -150, aB: -6, fB: -4, tA: 8, sA: 8, tB: -8, sB: -8 }), 'Reach over to the left'],
    ],
  },
  twist: {
    view: 'front', dur: 0.9, frames: [
      [S({ aA: 70, fA: 150, aB: -30, fB: -100, tA: 8, sA: 8, tB: -8, sB: -8 }), 'Rotate right'],
      [S({ aA: 30, fA: 100, aB: -70, fB: -150, tA: 8, sA: 8, tB: -8, sB: -8 }), 'Rotate left'],
    ],
  },
  neck: {
    view: 'front', dur: 1.4, frames: [
      [S({ ...standFront, tilt: -28 }), 'Ear to left shoulder'],
      [S({ ...standFront, tilt: 0, aA: 20, aB: -20 }), 'Roll shoulders back'],
      [S({ ...standFront, tilt: 28 }), 'Ear to right shoulder'],
    ],
  },
  calf: {
    view: 'side', dur: 0.9, frames: [
      [stand, 'Heels down'],
      [S({ ...stand, lift: 9, sA: -6, sB: -6 }), '⬆ Rise onto toes'],
    ],
  },
  tree: {
    view: 'front', dur: 2.2, frames: [
      [S({ aA: 168, fA: -172, aB: -168, fB: 172, tA: 3, sA: 3, tB: -58, sB: 62 }), 'Foot on inner thigh'],
      [S({ t: 3, aA: 170, fA: -174, aB: -166, fB: 170, tA: 3, sA: 3, tB: -60, sB: 64 }), 'Hold & breathe'],
    ],
  },
  breathe: {
    view: 'front', dur: 4, frames: [
      [standFront, 'Exhale slowly…'],
      [S({ aA: 165, fA: 170, aB: -165, fB: -170, tA: 3, sA: 3, tB: -3, sB: -3 }), 'Inhale deeply…'],
    ],
  },
  surya: {
    view: 'side', dur: 1.6, frames: [
      [S({ aA: 30, fA: 150, aB: 28, fB: 148 }), 'Prayer pose'],
      [armsUp, 'Arms up, gentle arch'],
      [fold, 'Fold forward'],
      [plankHigh, 'Step back to plank'],
      [cobra, 'Cobra — chest up'],
      [dog, 'Downward dog'],
      [fold, 'Step forward, fold'],
      [armsUp, 'Rise up'],
    ],
  },
  cobra: { view: 'side', dur: 2, frames: [[S({ ...cobra, t: 82, aA: -70, fA: 30, aB: -70, fB: 30 }), 'Lie face down'], [cobra, '⬆ Lift chest, elbows soft']] },
  child: { view: 'side', dur: 3, feet: false, frames: [[child, 'Sink hips to heels'], [S({ ...child, t: 108, aA: 104, fA: 96 }), 'Breathe into your back']] },
  bridge: {
    view: 'side', dur: 1.4, feet: true, frames: [
      [S({ t: -94, aA: 90, fA: 90, aB: 88, fB: 88, tA: 132, sA: 22, tB: 130, sB: 22 }), 'Lie on back, knees bent'],
      [S({ t: -112, aA: 72, fA: 72, aB: 70, fB: 70, tA: 112, sA: 8, tB: 110, sB: 8 }), '⬆ Lift hips, squeeze glutes'],
    ],
  },
  forward: { view: 'side', dur: 2.4, frames: [[S({ t: 95, aA: 8, fA: 6, aB: 4, fB: 4 }), 'Hinge at the hips'], [fold, 'Reach toward toes']] },
  burpee: {
    view: 'side', dur: 0.65, frames: [
      [stand, 'Stand'],
      [S({ ...squat, t: 70, aA: 10, fA: 8, aB: 6, fB: 6 }), 'Squat, hands down'],
      [plankHigh, 'Jump back to plank'],
      [S({ ...squat, t: 70, aA: 10, fA: 8, aB: 6, fB: 6 }), 'Jump feet in'],
      [S({ ...armsUp, lift: 16 }), '⬆ Jump up!'],
    ],
  },
  climber: {
    view: 'side', dur: 0.45, frames: [
      [S({ ...plankHigh, tA: 46, sA: -62 }), 'Left knee to chest'],
      [S({ ...plankHigh, tB: 46, sB: -62 }), 'Right knee to chest'],
    ],
  },
  deskpush: {
    view: 'side', dur: 1.2, frames: [
      [S({ t: 48, aA: 52, fA: 52, aB: 50, fB: 50, tA: -14, sA: -14, tB: -12, sB: -12 }), '⬆ Push away from desk'],
      [S({ t: 58, aA: -20, fA: 92, aB: -22, fB: 90, tA: -16, sA: -16, tB: -14, sB: -14 }), '⬇ Chest to desk edge'],
    ],
  },
};

// ---------- maths ----------
const rad = (d) => (d * Math.PI) / 180;
const dir = (a) => [Math.sin(rad(a)), Math.cos(rad(a))];
const ease = (x) => -(Math.cos(Math.PI * x) - 1) / 2;
const lerp = (a, b, k) => a + (b - a) * k;
const mix = (p, q, k) => Object.fromEntries(Object.keys(p).map((key) => [key, lerp(p[key], q[key], k)]));

function solve(p, view) {
  const front = view === 'front';
  const hip = [0, 0];
  const td = [Math.sin(rad(p.t)), -Math.cos(rad(p.t))];
  const sh = [hip[0] + td[0] * L.torso, hip[1] + td[1] * L.torso];
  const ht = rad(p.t + p.tilt);
  const head = [sh[0] + Math.sin(ht) * (L.neck + L.head), sh[1] - Math.cos(ht) * (L.neck + L.head)];
  const so = front ? 13 : 0, ho = front ? 8 : 0;
  const limb = (base, a1, l1, a2, l2) => {
    const d1 = dir(a1), mid = [base[0] + d1[0] * l1, base[1] + d1[1] * l1];
    const d2 = dir(a2), end = [mid[0] + d2[0] * l2, mid[1] + d2[1] * l2];
    return [base, mid, end];
  };
  const sA = [sh[0] + so, sh[1]], sB = [sh[0] - so, sh[1]];
  const hA = [hip[0] + ho, hip[1]], hB = [hip[0] - ho, hip[1]];
  const fig = {
    hip, sh, head, sA, sB, hA, hB,
    armA: limb(sA, p.aA, L.ua, p.fA, L.fa),
    armB: limb(sB, p.aB, L.ua, p.fB, L.fa),
    legA: limb(hA, p.tA, L.th, p.sA, L.sh),
    legB: limb(hB, p.tB, L.th, p.sB, L.sh),
  };
  // keep on the floor
  const pts = [fig.head, ...fig.armA, ...fig.armB, ...fig.legA, ...fig.legB, sh];
  let maxY = -1e9;
  for (const q of pts) maxY = Math.max(maxY, q[1] + (q === fig.head ? L.head : 0));
  const footY = Math.max(fig.legA[2][1], fig.legB[2][1]) + 4;
  maxY = Math.max(maxY, footY);
  const dy = GROUND - maxY - p.lift;
  // anchor: feet for side view (so squats sit back realistically), hips for front view
  const ax = front ? 0 : (fig.legA[2][0] + fig.legB[2][0]) / 2;
  return { fig, dx: -ax, dy };
}

function bboxX(fig, dx) {
  const xs = [fig.head[0] - L.head, fig.head[0] + L.head, ...[fig.armA, fig.armB, fig.legA, fig.legB].flat().map((q) => q[0]), fig.legA[2][0] + L.foot];
  return [Math.min(...xs) + dx, Math.max(...xs) + dx];
}

// ---------- component ----------
export default function Figure({ pose = 'squat', size = 200, color = '#00f5a0', paused = false, fast = false, onPhase, onRep, showFloor = true, frame = null }) {
  const def = POSES[pose] || POSES.squat;
  const [state, setState] = useState({ i: 0, k: 0 });
  const ref = useRef({ elapsed: 0, last: 0, lastIdx: -1, reps: 0 });
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // constant horizontal centring across all keyframes so the figure never drifts off-screen
  const centre = useMemo(() => {
    let lo = 1e9, hi = -1e9;
    def.frames.forEach(([p]) => { const { fig, dx } = solve(p, def.view); const [a, b] = bboxX(fig, dx); lo = Math.min(lo, a); hi = Math.max(hi, b); });
    return 100 - (lo + hi) / 2;
  }, [pose]);

  useEffect(() => {
    ref.current = { elapsed: 0, last: performance.now(), lastIdx: -1, reps: 0 };
    let raf;
    const n = def.frames.length;
    const seg = (def.dur * (fast ? 0.55 : 1)) * 1000;
    const tick = (now) => {
      const dt = Math.min(100, now - ref.current.last);
      ref.current.last = now;
      if (!pausedRef.current) {
        ref.current.elapsed = (ref.current.elapsed || 0) + (Number.isFinite(dt) ? dt : 16);
        const total = ref.current.elapsed / seg;
        const i = Math.floor(total) % n;
        const k = total - Math.floor(total);
        if (i !== ref.current.lastIdx) {
          const target = (i + 1) % n;
          onPhase?.(def.frames[target][1]);
          if (i === 0 && ref.current.lastIdx !== -1) { ref.current.reps++; onRep?.(ref.current.reps); }
          ref.current.lastIdx = i;
        }
        setState({ i, k });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pose, fast]);

  const n = def.frames.length;
  const si = Number.isFinite(state.i) ? ((state.i % n) + n) % n : 0;
  const p = frame != null ? def.frames[frame][0] : n === 1 ? def.frames[0][0] : mix(def.frames[si][0], def.frames[(si + 1) % n][0], ease(Number.isFinite(state.k) ? state.k : 0));
  const { fig, dx, dy } = solve(p, def.view);
  const X = (q) => q[0] + dx + centre;
  const Y = (q) => q[1] + dy;
  const gid = `fg-${pose}-${color.replace("#", "")}`;
  const side = def.view === 'side';
  const showFeet = def.feet !== false;

  // ---- realistic flat-illustration person ----
  const skin = '#d9a066', skinDark = '#b98350', hair = '#1d1b1a';
  const shirt = color, shirtDark = shade(color, 0.72);
  const shorts = '#232f4b', shortsDark = '#1a2338';
  const shoe = '#f4f6fb', sole = shade(color, 0.85);
  const P = (q) => [X(q), Y(q)];

  // tapered capsule between two points
  const Cap = ({ a, b, wa, wb, fill }) => {
    const [ax, ay] = a, [bx, by] = b;
    const dxs = bx - ax, dys = by - ay, len = Math.hypot(dxs, dys) || 1;
    const nx = -dys / len, ny = dxs / len;
    const ra = wa / 2, rb = wb / 2;
    return (
      <g fill={fill}>
        <path d={`M${ax + nx * ra} ${ay + ny * ra} L${bx + nx * rb} ${by + ny * rb} L${bx - nx * rb} ${by - ny * rb} L${ax - nx * ra} ${ay - ny * ra} Z`} />
        <circle cx={ax} cy={ay} r={ra} /><circle cx={bx} cy={by} r={rb} />
      </g>
    );
  };
  const along = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  const Arm = ({ seg, far }) => {
    const s = P(seg[0]), e = P(seg[1]), h = P(seg[2]);
    const sleeveEnd = along(s, e, 0.55);
    return (
      <g>
        <Cap a={s} b={e} wa={W.ua + 1} wb={W.fa + 1} fill={far ? skinDark : skin} />
        <Cap a={e} b={h} wa={W.fa + 1} wb={W.fa - 1.5} fill={far ? skinDark : skin} />
        <circle cx={h[0]} cy={h[1]} r={4.6} fill={far ? skinDark : skin} />
        <Cap a={s} b={sleeveEnd} wa={W.ua + 4} wb={W.ua + 3} fill={far ? shirtDark : shirt} />
      </g>
    );
  };
  const Leg = ({ seg, far, ang }) => {
    const h = P(seg[0]), k = P(seg[1]), f = P(seg[2]);
    const shortsEnd = along(h, k, 0.62);
    const sockTop = along(k, f, 0.86);
    // shoe points "forward" relative to the shin in side view
    const fwd = side ? [Math.cos(rad(ang)), -Math.sin(rad(ang))] : [0, 0];
    const toe = [f[0] + fwd[0] * 12, f[1] + fwd[1] * 12 + (side ? 0 : 3)];
    const heel = [f[0] - fwd[0] * 2, f[1] - fwd[1] * 2 + (side ? 0 : 1)];
    return (
      <g>
        <Cap a={h} b={k} wa={W.th + 1} wb={W.sh + 1} fill={far ? skinDark : skin} />
        <Cap a={k} b={f} wa={W.sh + 1} wb={W.sh - 4} fill={far ? skinDark : skin} />
        <Cap a={h} b={shortsEnd} wa={W.th + 5} wb={W.th + 4} fill={far ? shortsDark : shorts} />
        {showFeet && (
          <>
            <Cap a={sockTop} b={f} wa={W.sh - 2.5} wb={W.sh - 3} fill="#e9edf5" />
            {side
              ? <Cap a={heel} b={toe} wa={9} wb={7.5} fill={far ? '#c9cfdb' : shoe} />
              : <ellipse cx={f[0]} cy={f[1] + 4} rx="6.5" ry="5" fill={far ? '#c9cfdb' : shoe} />}
            {side && <Cap a={[heel[0], heel[1] + 3.2]} b={[toe[0], toe[1] + 3]} wa={3} wb={3} fill={sole} />}
          </>
        )}
      </g>
    );
  };

  const hip = P(fig.hip), shp = P(fig.sh), head = P(fig.head);
  const ht = rad(p.t + p.tilt);
  const up = [Math.sin(ht), -Math.cos(ht)];          // head "up" direction
  const fw = [Math.cos(ht), Math.sin(ht)];           // facing direction (side view)
  const neckTop = [head[0] - up[0] * 8, head[1] - up[1] * 8];
  const comX = (hip[0] + shp[0]) / 2;

  const Head = () => side ? (
    <g>
      <Cap a={along(shp, neckTop, 0.1)} b={neckTop} wa={8} wb={7} fill={skinDark} />
      <circle cx={head[0] - fw[0] * 1.6 + up[0] * 1.2} cy={head[1] - fw[1] * 1.6 + up[1] * 1.2} r={L.head + 0.6} fill={hair} />
      <circle cx={head[0] + fw[0] * 1.8 - up[0] * 0.8} cy={head[1] + fw[1] * 1.8 - up[1] * 0.8} r={L.head - 1.3} fill={skin} />
      {/* hair fringe over the top/back */}
      <path d={`M${head[0] - fw[0] * 11 + up[0] * 2} ${head[1] - fw[1] * 11 + up[1] * 2}
                Q${head[0] + up[0] * 14} ${head[1] + up[1] * 14} ${head[0] + fw[0] * 9 + up[0] * 5} ${head[1] + fw[1] * 9 + up[1] * 5}
                L${head[0] + up[0] * 3} ${head[1] + up[1] * 3} Z`} fill={hair} />
      <circle cx={head[0] - fw[0] * 2.5} cy={head[1] - fw[1] * 2.5} r="2.4" fill={skinDark} />
      <circle cx={head[0] + fw[0] * 5.2 + up[0] * 1.5} cy={head[1] + fw[1] * 5.2 + up[1] * 1.5} r="1.35" fill="#141414" />
      <path d={`M${head[0] + fw[0] * 4 - up[0] * 4} ${head[1] + fw[1] * 4 - up[1] * 4} q ${fw[0] * 2} ${fw[1] * 2} ${fw[0] * 3.6 + up[0] * 0.8} ${fw[1] * 3.6 + up[1] * 0.8}`}
        stroke="#7a4a2a" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </g>
  ) : (
    <g>
      <Cap a={along(shp, neckTop, 0.1)} b={neckTop} wa={9} wb={8} fill={skinDark} />
      <circle cx={head[0] + up[0] * 1.5} cy={head[1] + up[1] * 1.5} r={L.head + 0.8} fill={hair} />
      <ellipse cx={head[0] - up[0] * 1} cy={head[1] - up[1] * 1 + 0.5} rx={L.head - 1.2} ry={L.head - 0.4} fill={skin}
        transform={`rotate(${p.tilt} ${head[0]} ${head[1]})`} />
      <path d={`M${head[0] - 10} ${head[1] - 2} Q${head[0]} ${head[1] - 15} ${head[0] + 10} ${head[1] - 2} Q${head[0]} ${head[1] - 8} ${head[0] - 10} ${head[1] - 2} Z`}
        fill={hair} transform={`rotate(${p.tilt} ${head[0]} ${head[1]})`} />
      <g transform={`rotate(${p.tilt} ${head[0]} ${head[1]})`}>
        <circle cx={head[0] - 3.6} cy={head[1] + 1} r="1.3" fill="#141414" />
        <circle cx={head[0] + 3.6} cy={head[1] + 1} r="1.3" fill="#141414" />
        <path d={`M${head[0] - 2.6} ${head[1] + 5.2} Q${head[0]} ${head[1] + 7} ${head[0] + 2.6} ${head[1] + 5.2}`} stroke="#7a4a2a" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      </g>
    </g>
  );

  const Torso = () => side ? (
    <g>
      <Cap a={hip} b={along(hip, shp, 0.25)} wa={W.torso + 2} wb={W.torso + 1} fill={shorts} />
      <Cap a={along(hip, shp, 0.18)} b={shp} wa={W.torso} wb={W.torso + 2} fill={shirt} />
      <Cap a={along(hip, shp, 0.2)} b={along(hip, shp, 0.24)} wa={W.torso + 0.5} wb={W.torso + 0.5} fill={shirtDark} />
    </g>
  ) : (() => {
    const sA = P(fig.sA), sB = P(fig.sB), hA = P(fig.hA), hB = P(fig.hB);
    const wA = along(hA, sA, 0.22), wB = along(hB, sB, 0.22);
    return (
      <g>
        <path d={`M${hA[0] + 3} ${hA[1] + 4} L${hB[0] - 3} ${hB[1] + 4} L${wB[0] - 2} ${wB[1]} L${wA[0] + 2} ${wA[1]} Z`} fill={shorts} stroke={shorts} strokeWidth="10" strokeLinejoin="round" />
        <path d={`M${sA[0] + 2} ${sA[1]} L${sB[0] - 2} ${sB[1]} L${wB[0] - 1} ${wB[1]} L${wA[0] + 1} ${wA[1]} Z`} fill={shirt} stroke={shirt} strokeWidth="10" strokeLinejoin="round" />
        <path d={`M${(sA[0] + sB[0]) / 2 - 4} ${sA[1] - 3} Q${(sA[0] + sB[0]) / 2} ${sA[1] + 3} ${(sA[0] + sB[0]) / 2 + 4} ${sA[1] - 3}`} stroke={shirtDark} strokeWidth="1.6" fill="none" />
      </g>
    );
  })();

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className="figure2" aria-hidden>
      <defs>
        <radialGradient id={`${gid}-sh`}><stop offset="0" stopColor="#000" stopOpacity=".55" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${gid}-glow`}><stop offset="0" stopColor={color} stopOpacity=".2" /><stop offset="1" stopColor={color} stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="100" cy="110" r="88" fill={`url(#${gid}-glow)`} />
      {showFloor && (
        <>
          <rect x="14" y={GROUND + 5} width="172" height="6" rx="3" fill="rgba(255,255,255,.08)" />
          <ellipse cx={comX} cy={GROUND + 6} rx={side ? 50 : 32} ry="5" fill={`url(#${gid}-sh)`} />
        </>
      )}
      {side ? (
        <>
          <Arm seg={fig.armB} far />
          <Leg seg={fig.legB} far ang={p.sB} />
          {Torso}
          <Head />
          <Leg seg={fig.legA} ang={p.sA} />
          <Arm seg={fig.armA} />
        </>
      ) : (
        <>
          <Leg seg={fig.legA} ang={0} />
          <Leg seg={fig.legB} ang={0} />
          {Torso}
          <Arm seg={fig.armA} />
          <Arm seg={fig.armB} />
          <Head />
        </>
      )}
    </svg>
  );
}

function shade(hex, k) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
