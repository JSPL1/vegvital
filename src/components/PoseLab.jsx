import Figure, { POSES } from './Figure.jsx';

// Dev-only gallery of every keyframe (open the app with #poses).
export default function PoseLab() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 8, background: '#070b14' }}>
      {Object.entries(POSES).flatMap(([name, def]) => def.frames.map((f, i) => (
        <div key={name + i} style={{ width: 120, color: '#ccc', fontSize: 10, textAlign: 'center' }}>
          <Figure pose={name} frame={i} size={120} />
          <div>{name} {i}: {f[1]}</div>
        </div>
      )))}
    </div>
  );
}
