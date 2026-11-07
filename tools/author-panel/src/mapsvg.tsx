// The editor map's drawing and its input (editor-map-and-story-rulings.md E3a): the rooms as SVG
// buttons, wheel and drag pans, Cmd/Ctrl-wheel zooms, and the keyboard row.
import { useEffect, useRef, useState } from 'react';
import type { Level, MapProps, Reach } from './areamap.tsx';
import type { MapRoom } from './map.ts';
import * as map from './map.ts';
import { M } from './map.ts';
import { at, Box, half, Edges, Hulls, Pills, RING, Stubs, type Marks } from './mapdraw.tsx';
import { cellAt, dragged, toward } from './mapedit.ts';
import { edit, mapCommand, shown } from './mapwire.ts';

/** `locked`: the map's drag lock (areamap.tsx); rooms do not move while it is on. */
export type DrawProps = { p: MapProps; l: Level; reach: Reach; locked: boolean };

export function Drawing(d: DrawProps) {
  const svg = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<string>();
  const [focus, setFocus] = useState<string>();
  const view = d.l.v.view!;
  useWheel(svg, d);
  const tab = tabOf(d, focus);
  return (
    <svg
      ref={svg}
      role="group"
      tabIndex={-1}
      aria-label={`Area map, level ${d.l.z}`}
      className="absolute inset-0 size-full touch-none select-none"
      onKeyDown={(e) => keys(e, d, tab, setFocus)}
      onPointerDown={(e) => pan(e, d)}
    >
      <Hulls hulls={map.hulls(d.l.level, map.areas(d.p.story.map))} v={view} />
      <Edges level={d.l.level} v={view} />
      <Stubs level={d.l.level} v={view} />
      {d.l.level.map((r) => (
        <Room
          key={r.key}
          r={r}
          d={d}
          m={marks(r, d)}
          tab={r === tab}
          focus={setFocus}
          hover={setHover}
        />
      ))}
      <Pills
        rooms={d.l.level.filter((r) => ([d.p.selected, d.p.here].includes(r.ref) || r.key === hover) && map.pill(r.key, view.zoom, r.ref === d.p.here))}
        v={view}
        here={d.p.here}
      />
      <Grow d={d} />
    </svg>
  );
}

/** The one room in the tab order: the focused one, else the map's way in. */
const tabOf = (d: DrawProps, focus?: string) =>
  d.l.level.find((r) => r.key === focus) ??
  map.entry(d.l.level, d.l.sel?.key, d.l.level.find((r) => r.ref === d.p.here)?.key);

const marks = (r: MapRoom, d: DrawProps): Marks => ({
  unreached: d.reach.unreached.has(r.ref),
  locked: d.reach.locked.has(r.ref),
  visited: d.reach.visited.has(r.ref),
  here: r.ref === d.p.here,
  selected: r.ref === d.p.selected,
});

/** One room: a button named for screen readers; click selects, double-click goes, Alt-click opens. */
function Room({
  r,
  d,
  m,
  tab,
  focus,
  hover,
}: {
  r: MapRoom;
  d: DrawProps;
  m: Marks;
  tab: boolean;
  focus: (k: string) => void;
  hover: (k?: string) => void;
}) {
  return (
    <g
      data-key={r.key}
      role="button"
      tabIndex={tab ? 0 : -1}
      aria-label={map.name(r, m)}
      className="group cursor-pointer outline-none"
      onFocus={() => focus(r.key)}
      onPointerEnter={() => hover(r.key)}
      onPointerLeave={() => hover(undefined)}
      onClick={(e) => (e.altKey ? d.p.open(r.ref) : d.p.pick(map.select(r)))}
      onDoubleClick={() => d.p.go(r.key)}
    >
      <title>{map.name(r, {})}</title>
      <Box r={r} v={d.l.v.view!} m={m} />
    </g>
  );
}

/** A + on each side the selected room can grow from (map.grows): a click or Enter makes and
 * links a new room that way and selects it. After the rooms, so Tab from the room reaches them. */
function Grow({ d }: { d: DrawProps }) {
  const r = d.l.level.find((o) => o.ref === d.p.selected);
  if (!r) return null;
  const v = d.l.v.view!;
  const c = at(r, v);
  const [hw, hh] = half(v);
  const k = M.stub * Math.SQRT1_2; // mutate-skip: placement; up and down sit where their stubs would
  const spot: Record<string, [number, number, number]> = {
    north: [c.x, c.y - hh - M.plus - 3, M.plus], // mutate-skip: placement
    east: [c.x + hw + M.plus + 3, c.y, M.plus], // mutate-skip: placement
    south: [c.x, c.y + hh + M.plus + 3, M.plus], // mutate-skip: placement
    west: [c.x - hw - M.plus - 3, c.y, M.plus], // mutate-skip: placement
    up: [c.x + hw + k, c.y - hh - k, M.plus - 2], // mutate-skip: placement
    down: [c.x + hw + k, c.y + hh + k, M.plus - 2], // mutate-skip: placement
  };
  return map.grows(r, d.p.story.map).map((dir) => <Plus key={dir} r={r} dir={dir} at={spot[dir]} />);
}

/** One grow handle: a button, kept out of pan()'s drag. */
function Plus({ r, dir, at: [x, y, s] }: { r: MapRoom; dir: string; at: [number, number, number] }) {
  const grow = () => mapCommand('map-grow', r.key, dir);
  const a = s / 2; // mutate-skip: placement, the + arm
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${r.key}: new room ${dir}`}
      className="group cursor-pointer outline-none"
      onPointerDown={(e) => e.stopPropagation()} // else pan() captures the pointer and the click is lost
      onClick={grow}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation(); // else the map's own Enter picks, or with Shift plays, the room it had
        grow();
      }}
    >
      <title>{`New room ${dir}`}</title>
      <circle
        cx={x}
        cy={y}
        r={s}
        className="fill-background stroke-input group-hover:stroke-ring"
      />
      <path d={`M${x - a},${y}H${x + a}M${x},${y - a}V${y + a}`} className="stroke-foreground" />
      <circle cx={x} cy={y} r={s + 2} className={RING} /> {/* mutate-skip: the focus ring's gap */}
    </g>
  );
}

/** Wheel pans at once; Cmd/Ctrl-wheel (and a trackpad pinch) zooms about the cursor. Non-passive. */
function useWheel(svg: React.RefObject<SVGSVGElement | null>, d: DrawProps) {
  const latest = useRef(d);
  latest.current = d;
  useEffect(() => {
    const el = svg.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const { v, level, size, least } = latest.current.l;
      const now = v.now.current!;
      const box = el.getBoundingClientRect();
      const moved =
        e.ctrlKey || e.metaKey
          ? map.zoomAt(now, Math.exp(-e.deltaY / 100), {
              x: e.clientX - box.left,
              y: e.clientY - box.top,
            }, least)
          : { ...now, x: now.x - e.deltaX, y: now.y - e.deltaY };
      v.set(map.keep(moved, map.bounds(level), size));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [svg]);
}

/** A drag that starts on empty ground pans; one that starts on a room moves it, unless the map is locked. */
function pan(e: React.PointerEvent<SVGSVGElement>, d: DrawProps) {
  const key = (e.target as Element).closest('[data-key]')?.getAttribute('data-key');
  const r = d.l.level.find((o) => o.key === key);
  if (r) return d.locked ? undefined : drag(e, d, r); // locked: a press only clicks
  const el = e.currentTarget;
  el.setPointerCapture(e.pointerId);
  const [x0, y0, start] = [e.clientX, e.clientY, d.l.v.now.current!];
  const move = (m: PointerEvent) =>
    d.l.v.set(
      map.keep(
        { ...start, x: start.x + m.clientX - x0, y: start.y + m.clientY - y0 },
        map.bounds(d.l.level),
        d.l.size,
      ),
    );
  const up = () => (
    el.removeEventListener('pointermove', move),
    el.removeEventListener('pointerup', up),
    el.removeEventListener('pointercancel', up)
  );
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up); // a cancelled pan ends where it is, as a release does
}

/** A room dragged past a few pixels: to an empty cell moves it there; Shift onto another room on the
 * level draws an exit both ways. Window listeners, not pointer capture: a capture would send the
 * ending click to the SVG, and a plain click must still select. The click that ends a drag does not. */
function drag(e: React.PointerEvent<SVGSVGElement>, d: DrawProps, r: MapRoom) {
  const [p0, box] = [{ x: e.clientX, y: e.clientY }, e.currentTarget.getBoundingClientRect()];
  const end = () => (
    window.removeEventListener('pointerup', up),
    window.removeEventListener('pointercancel', end)
  );
  const up = (u: PointerEvent) => {
    end();
    if (!dragged(p0, { x: u.clientX, y: u.clientY })) return;
    const stop = (c: MouseEvent) => c.stopPropagation();
    window.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', stop, { capture: true }));
    const [x, y] = [u.clientX - box.left, u.clientY - box.top];
    if (x < 0 || y < 0 || x > box.width || y > box.height) return; // let go off the map: no edit
    const at = { ...cellAt(d.l.v.now.current!, { x, y }), z: d.l.z };
    if (!u.shiftKey) return edit((ed) => ed.place(r, at));
    const to = d.l.level.find((o) => o.at!.x === at.x && o.at!.y === at.y);
    const dir = to && toward(r.at!, to.at!);
    if (!to || !dir) return shown.tell('Shift-drag onto another room on this level draws an exit');
    edit((ed) => ed.link(r, dir, to));
  };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', end);
}

/** Arrows, PageUp and PageDown, Enter, Shift-Enter, `+` `-` `0` and Esc, per the E3a keyboard row. */
function keys(
  e: React.KeyboardEvent<SVGSVGElement>,
  d: DrawProps,
  from: MapRoom | undefined,
  setFocus: (k: string) => void,
) {
  const svg = e.currentTarget;
  const i = d.l.all.indexOf(d.l.z);
  const room = (r?: MapRoom) =>
    r &&
    (setFocus(r.key), svg.querySelector<SVGElement>(`[data-key="${CSS.escape(r.key)}"]`)?.focus());
  const act: Record<string, (() => unknown) | undefined> = {
    Enter: () => from && (e.shiftKey ? d.p.go(from.key) : d.p.pick(map.select(from))),
    // the focused room leaves with its level: focus stays in the map
    PageUp: () => i < d.l.all.length - 1 && (svg.focus(), d.l.toLevel(d.l.all[i + 1])),
    PageDown: () => i > 0 && (svg.focus(), d.l.toLevel(d.l.all[i - 1])),
    '+': () => d.l.zoom(M.step),
    '=': () => d.l.zoom(M.step),
    '-': () => d.l.zoom(1 / M.step),
    '0': d.l.fit,
    Escape: () =>
      svg
        .closest('section')
        ?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
        ?.focus(),
  };
  const run = e.key.startsWith('Arrow')
    ? () => from && room(map.nearest(d.l.level, from, e.key))
    : act[e.key];
  if (!run) return;
  e.preventDefault();
  run();
}
