// The editor map's SVG marks (editor-map-and-story-rulings.md E3a): hulls, exits, stubs, rooms and
// label pills, drawn in screen px from a View so strokes and labels keep their size at any zoom.
import { Lock, MapPin } from 'lucide-react';
import type { MapRoom } from './map.ts';
import { centre, edges, label, M, type View } from './map.ts';

// Literal classes so Tailwind emits them: area n's hue as fill (0.12 light, 0.18 dark) and stroke.
const HUE = [
  'fill-area-1/12 stroke-area-1 dark:fill-area-1/18',
  'fill-area-2/12 stroke-area-2 dark:fill-area-2/18',
  'fill-area-3/12 stroke-area-3 dark:fill-area-3/18',
  'fill-area-4/12 stroke-area-4 dark:fill-area-4/18',
  'fill-area-5/12 stroke-area-5 dark:fill-area-5/18',
  'fill-area-6/12 stroke-area-6 dark:fill-area-6/18',
];
const DASH = '[stroke-dasharray:4_3]';

/** A room's centre on screen. */
export const at = (r: MapRoom, v: View) => {
  const c = centre(r.at!);
  return { x: c.x * v.zoom + v.x, y: c.y * v.zoom + v.y };
};

export type Hull = {
  area: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hue: number;
  dashed: boolean;
};
export function Hulls({ hulls, v }: { hulls: Hull[]; v: View }) {
  return (
    <g aria-hidden>
      {hulls.map((h) => (
        <g key={h.area}>
          <rect
            x={h.x * v.zoom + v.x}
            y={h.y * v.zoom + v.y}
            width={h.w * v.zoom}
            height={h.h * v.zoom}
            rx={6}
            className={`stroke-[1.5] ${HUE[h.hue - 1]} ${h.dashed ? DASH : ''}`}
          />
          <text
            x={h.x * v.zoom + v.x + 4}
            y={h.y * v.zoom + v.y + 12}
            className="fill-foreground text-[11px] font-semibold tracking-[0.06em] uppercase"
          >
            {h.area}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Where the line from `a` toward `b` leaves a's box (or disc in the overview). */
function rim(a: { x: number; y: number }, b: { x: number; y: number }, zoom: number) {
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  const [hw, hh] =
    zoom < M.overview ? [M.disc / 2, M.disc / 2] : [(M.w / 2) * zoom, (M.h / 2) * zoom];
  const s = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return { x: a.x + dx * s, y: a.y + dy * s };
}

export function Edges({ level, v }: { level: MapRoom[]; v: View }) {
  const on = new Map(level.map((r) => [r.key, at(r, v)]));
  return (
    <g aria-hidden className="fill-none stroke-input">
      {edges(level).map((e) => {
        const [a, b] = [on.get(e.from)!, on.get(e.to)!];
        const [p, q] = [rim(a, b, v.zoom), rim(b, a, v.zoom)];
        const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        const [ux, uy] = [(q.x - p.x) / len, (q.y - p.y) / len];
        const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
        const t = M.tick / 2;
        return (
          <g key={`${e.from} ${e.to}`}>
            <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} className={e.hidden ? DASH : ''} />
            {e.oneWay ? (
              <polygon
                className="fill-input stroke-none"
                points={`${q.x},${q.y} ${q.x - ux * M.tri - uy * 3},${q.y - uy * M.tri + ux * 3} ${q.x - ux * M.tri + uy * 3},${q.y - uy * M.tri - ux * 3}`}
              />
            ) : null}
            {e.barrier ? (
              <line x1={mid.x - uy * t} y1={mid.y + ux * t} x2={mid.x + uy * t} y2={mid.y - ux * t}>
                <title>{e.barrier}</title>
              </line>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

/** `up` and `down` exits: a 12 px stub at 45° from the top-right or bottom-right corner. */
export function Stubs({ level, v }: { level: MapRoom[]; v: View }) {
  const d = M.stub * Math.SQRT1_2;
  return (
    <g aria-hidden className="fill-input stroke-input">
      {level.flatMap((r) =>
        r.exits
          .filter((e) => e.dir === 'up' || e.dir === 'down')
          .map((e) => {
            const s = e.dir === 'up' ? -1 : 1;
            const c = at(r, v);
            const [hw, hh] =
              v.zoom < M.overview
                ? [M.disc / 2, M.disc / 2]
                : [(M.w / 2) * v.zoom, (M.h / 2) * v.zoom];
            const [x0, y0] = [c.x + hw, c.y + s * hh];
            const [x1, y1] = [x0 + d, y0 + s * d];
            const tri = `${x1 - M.tri / 2},${y1} ${x1 + M.tri / 2},${y1} ${x1},${y1 + s * M.tri}`;
            return (
              <g key={`${r.key} ${e.dir} ${e.to}`}>
                <line x1={x0} y1={y0} x2={x1} y2={y1} />
                <polygon points={tri} />
              </g>
            );
          }),
      )}
    </g>
  );
}

export type Marks = {
  unreached: boolean;
  locked: boolean;
  visited: boolean;
  here: boolean;
  selected: boolean;
};

const RING = 'hidden fill-none stroke-ring stroke-2 group-focus-visible:block'; // the focus ring

/** The box (or overview disc) with its state's stroke and fill, the pin, the lock and the label. */
export function Box({ r, v, m }: { r: MapRoom; v: View; m: Marks }) {
  const c = at(r, v);
  // one stroke colour each: selected, else unreached, else visited, else the default
  const stroke = m.selected
    ? 'stroke-2 stroke-ring'
    : m.unreached
      ? `stroke-muted-foreground ${DASH}`
      : m.visited
        ? 'stroke-foreground'
        : 'stroke-input';
  const look = `${m.selected ? 'fill-accent' : m.unreached ? 'fill-none' : 'fill-card'} ${stroke}`;
  if (v.zoom < M.overview)
    return (
      <>
        <circle cx={c.x} cy={c.y} r={M.disc / 2} className={`${m.unreached ? 'fill-none' : 'fill-input'} ${stroke}`} />
        <circle cx={c.x} cy={c.y} r={M.disc / 2 + 3} className={RING} />
      </>
    );
  const [w, h] = [M.w * v.zoom, M.h * v.zoom];
  const [x, y] = [c.x - w / 2, c.y - h / 2];
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={6} className={look} />
      <rect x={x - 2} y={y - 2} width={w + 4} height={h + 4} rx={8} className={RING} />
      <Inside r={r} zoom={v.zoom} m={m} c={c} x={x} w={w} />
    </>
  );
}

/** The pin (current room), the lock (from zoom 1) and the clipped key (not on the current room). */
function Inside(i: {
  r: MapRoom;
  zoom: number;
  m: Marks;
  c: { x: number; y: number };
  x: number;
  w: number;
}) {
  const { m, c } = i;
  const text = label(i.r.key, i.zoom);
  const lock = M.lock;
  return (
    <>
      {m.here ? (
        <MapPin x={i.x + 2} y={c.y - 6} width={12} height={12} className="text-primary" />
      ) : null}
      {m.locked && i.zoom >= M.labels ? (
        <Lock
          x={i.x + i.w - lock - 2}
          y={c.y - lock / 2}
          width={lock}
          height={lock}
          className="text-muted-foreground"
        />
      ) : null}
      {text && 'text' in text && !m.here ? (
        <text
          x={c.x}
          y={c.y + 4}
          textAnchor="middle"
          className={`font-mono text-xs ${m.unreached ? 'fill-muted-foreground' : 'fill-foreground'}`}
        >
          {text.text}
        </text>
      ) : null}
    </>
  );
}

/** The marked rooms' full keys in pills over the drawing (the current one semibold). */
export function Pills({ rooms, v, here }: { rooms: MapRoom[]; v: View; here?: string }) {
  return (
    <g aria-hidden>
      {rooms.map((r) => {
        const c = at(r, v);
        const w = r.key.length * M.char + 2 * M.inset;
        const y = c.y - (v.zoom < M.overview ? M.disc / 2 : (M.h / 2) * v.zoom) - 18; // above the box
        return (
          <g key={r.key} className="pointer-events-none">
            <rect
              x={c.x - w / 2}
              y={y}
              width={w}
              height={16}
              rx={4}
              className="fill-background stroke-input"
            />
            <text
              x={c.x}
              y={y + 12}
              textAnchor="middle"
              className={`fill-foreground font-mono text-xs ${r.ref === here ? 'font-semibold' : ''}`}
            >
              {r.key}
            </text>
          </g>
        );
      })}
    </g>
  );
}
