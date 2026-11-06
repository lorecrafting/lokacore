// The editor's always-on area map (editor-map-and-story-rulings.md E3a): one level of rooms in plain
// SVG, click selects, double-click goes, Alt-click opens the source; zoom, pan, keys and levels.
import {
  ChevronDown,
  ChevronUp,
  Lock,
  LockOpen,
  Maximize,
  Play,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from '../../../mobile/app/book/tokens.ts';
import { templates, type Story, type Template } from './author.ts';
import type { MapRoom } from './map.ts';
import { Button } from './components/ui/button.tsx';
import * as map from './map.ts';
import { M, type Box as Size, type View } from './map.ts';
import { Drawing } from './mapsvg.tsx';
import { cellAt, freeKey } from './mapedit.ts';
import { alone, edit, shown } from './mapwire.ts';
import type { Selection } from './shell.ts';

export type MapProps = {
  story: Story;
  here?: string; // the Book's room, a ref
  visited: string[]; // refs
  selected?: string; // the selected definition's ref
  pick: (s: Selection) => void;
  go: (key: string) => void;
  open: (key: string) => void;
  segment: React.ReactNode;
};

/** The view, set at once or eased over `motion.quick` (a cut under reduced motion). */
function useView() {
  const [view, setView] = useState<View>();
  const now = useRef(view);
  const frame = useRef(0);
  const set = (v: View) => {
    cancelAnimationFrame(frame.current);
    now.current = v;
    setView(v);
  };
  const ease = (to: View) => {
    const from = now.current;
    if (!from || matchMedia('(prefers-reduced-motion: reduce)').matches) return set(to);
    cancelAnimationFrame(frame.current);
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / motion.quick.duration);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const v = {
        zoom: from.zoom + (to.zoom - from.zoom) * e,
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e,
      };
      now.current = v;
      setView(v);
      if (k < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  };
  return { view, now, set, ease };
}

/** The drawing's size in px, followed as the slot or column resizes. */
function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current!;
    const seen = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    seen.observe(el);
    return () => seen.disconnect();
  }, []);
  return [ref, size] as const;
}

/** The level shown, its fitted view, and the moves that change them. */
function useLevel(p: MapProps) {
  const rooms = p.story.map;
  const all = map.levels(rooms);
  const sel = rooms.find((r) => r.ref === p.selected);
  const here = rooms.find((r) => r.ref === p.here);
  const [picked, setZ] = useState(() =>
    map.levelOf(rooms, sel?.key, map.levelOf(rooms, here?.key, all[0] ?? 0)),
  );
  const z = all.includes(picked) ? picked : (all[0] ?? 0); // a recompile can empty the level picked
  const level = map.onLevel(rooms, z);
  const [ref, size] = useSize();
  const v = useView();
  const fitted = (nz: number) => map.fit(map.bounds(map.onLevel(rooms, nz)), size);
  const toLevel = (nz: number, at?: map.At) => {
    setZ(nz);
    v.set(at ? map.show(fitted(nz), size, at) : fitted(nz));
  };
  useEffect(
    () => void (size.w && level.length && !v.view && v.set(fitted(z))),
    [size.w, level.length],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  useFollow(rooms, sel, z, size, v, toLevel);
  useFollow(rooms, here, z, size, v, toLevel);
  const centre = { x: size.w / 2, y: size.h / 2 };
  const zoom = (f: number) =>
    v.now.current &&
    v.ease(map.keep(map.zoomAt(v.now.current, f, centre), map.bounds(level), size));
  return { all, sel, z, level, ref, size, v, toLevel, zoom, fit: () => v.ease(fitted(z)) };
}
export type Level = ReturnType<typeof useLevel>;

/** When `r` becomes the selected or current room, or moves level: its level, and a pan only if it is off screen. */
function useFollow(
  rooms: MapRoom[],
  r: MapRoom | undefined,
  z: number,
  size: Size,
  v: ReturnType<typeof useView>,
  toLevel: (z: number, at: map.At) => void,
) {
  useEffect(() => {
    if (!r?.at || !size.w || !v.now.current) return;
    const nz = map.levelOf(rooms, r.key, z);
    if (nz !== z) toLevel(nz, r.at);
    else v.ease(map.show(v.now.current, size, r.at));
  }, [r?.ref, r?.at?.z, size.w > 0]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function AreaMap(p: MapProps) {
  const l = useLevel(p);
  const reach = reachOf(p);
  const [told, tell] = useState('');
  // owner plan: the whole map locks against drags, in browser storage, never in the cartridge; locked by default
  const [locked, lock] = useState(() => localStorage.getItem(LOCK) !== 'off');
  useEffect(() => localStorage.setItem(LOCK, locked ? 'on' : 'off'), [locked]);
  shown.rooms = p.story.map;
  useEffect(() => tell(''), [p.story]); // a recompile clears the last refusal
  useEffect(() => ((shown.tell = tell), () => void (shown.tell = alone)), []);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Header p={p} l={l} locked={locked} lock={lock} />
      <div
        ref={l.ref}
        className="relative min-h-0 flex-1 overflow-hidden"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => (locked ? tell(UNLOCK) : drop(e, p, l))}
      >
        {l.v.view && l.level.length ? <Drawing p={p} l={l} reach={reach} locked={locked} /> : null}
      </div>
      <Unplaced rooms={p.story.map.filter((r) => !r.at)} pick={p.pick} />
      <Templates story={p.story} />
      <p
        role={told ? 'alert' : undefined}
        className={`truncate px-2 py-1 text-xs ${told ? 'text-destructive' : 'text-muted-foreground'}`}
      >
        {told || map.footer(p.story.map, reach.unreached, reach.locked)}
      </p>
      <p aria-live="polite" className="sr-only">{`level ${l.z}, ${l.level.length} rooms`}</p>
    </div>
  );
}

const LOCK = 'loka.author.mapLock';
const UNLOCK = 'The map is locked: unlock it in the map header to drag';

/** An Unplaced chip dropped on the map: its room's layout row at the cell under the pointer. A
 * template chip dropped on a room: a child of it there, keyed `<template>_<n>`. */
function drop(e: React.DragEvent<HTMLDivElement>, p: MapProps, l: Level) {
  const r = p.story.map.find((o) => o.key === e.dataTransfer.getData('text/x-loka-room'));
  const [dir, up] = e.dataTransfer.getData('text/x-loka-template').split('/');
  const box = e.currentTarget.getBoundingClientRect();
  if (!r && !up) return;
  if (!l.v.view) return shown.tell('Place one room in layout.json first: the map has no cells yet');
  const at = cellAt(l.v.now.current!, { x: e.clientX - box.left, y: e.clientY - box.top });
  if (r) return edit((ed) => ed.place(r, { ...at, z: l.z }));
  const room = l.level.find((o) => o.at?.x === at.x && o.at?.y === at.y);
  if (!room) return; // a template dropped on an empty cell makes nothing
  const kind = dir === 'npcs' ? 'npcs' : 'items';
  const singular = kind === 'npcs' ? 'npc' : 'item';
  const taken = p.story.graph.nodes.filter((n) => n.kind === singular).map((n) => n.ref.split('/')[1]);
  const key = freeKey(up, new Set(taken)); // a key taken by an uncompiled file: the starter refuses
  edit((ed) => ed.made(room, kind, key, up));
}

const reachOf = (p: MapProps) => ({
  unreached: new Set(Object.values(p.story.report.unreachable).flat()),
  locked: new Set(p.story.report.behind_lock.rooms),
  visited: new Set(p.visited),
});
export type Reach = ReturnType<typeof reachOf>;

function Icon({
  label,
  icon: I,
  run,
  off,
}: {
  label: string;
  icon: typeof Play;
  run: () => void;
  off?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className="size-5"
      aria-label={label}
      title={label}
      disabled={off}
      onClick={run}
    >
      <I />
    </Button>
  );
}

/** The segment, the level stepper (only when rooms span levels), the drag lock, zoom, fit and Go here. */
type Lockable = { locked: boolean; lock: (on: boolean) => void };
function Header({ p, l, locked, lock }: { p: MapProps; l: Level } & Lockable) {
  const i = l.all.indexOf(l.z);
  return (
    <div className="flex h-8 shrink-0 items-center gap-0 px-1">
      {p.segment}
      <span className="flex-1" />
      {l.all.length > 1 ? (
        <>
          <Icon
            label="Level up"
            icon={ChevronUp}
            run={() => l.toLevel(l.all[i + 1])}
            off={i === l.all.length - 1}
          />
          <span className="w-[3ch] text-center font-mono text-xs">{l.z}</span>
          <Icon
            label="Level down"
            icon={ChevronDown}
            run={() => l.toLevel(l.all[i - 1])}
            off={i === 0}
          />
        </>
      ) : null}
      <Icon
        label={locked ? 'Unlock map dragging' : 'Lock map dragging'}
        icon={locked ? Lock : LockOpen}
        run={() => lock(!locked)}
      />
      <Icon label="Zoom in" icon={ZoomIn} run={() => l.zoom(M.step)} />
      <Icon label="Zoom out" icon={ZoomOut} run={() => l.zoom(1 / M.step)} />
      <Icon label="Fit level" icon={Maximize} run={l.fit} />
      {l.sel ? <Icon label="Go here" icon={Play} run={() => p.go(l.sel!.key)} /> : null}
    </div>
  );
}

/** The abstract NPCs and items as chips (`~` label); a drag onto a room makes a child there. */
function Templates({ story }: { story: Story }) {
  const [all, set] = useState<Template[]>([]);
  useEffect(() => void templates().then(set, () => set([])), [story]);
  if (!all.length) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-t px-2 py-1 text-xs">
      <span className="text-muted-foreground">~</span>
      {all.map((t) => (
        <span
          key={`${t.dir}/${t.key}`}
          className="cursor-grab rounded-sm border px-1 font-mono"
          draggable
          onDragStart={(e) => e.dataTransfer.setData('text/x-loka-template', `${t.dir}/${t.key}`)}
        >
          {t.key}
        </span>
      ))}
    </div>
  );
}

/** Rooms with no layout row, as hollow dashed chips; a click selects, a drag onto the map places. */
function Unplaced({ rooms, pick }: { rooms: MapRoom[]; pick: (s: Selection) => void }) {
  if (!rooms.length) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-t px-2 py-1 text-xs">
      <span className="text-muted-foreground">Unplaced ({rooms.length})</span>
      {rooms.map((r) => (
        <button
          key={r.key}
          type="button"
          className="rounded-sm border border-dashed border-muted-foreground px-1 font-mono text-muted-foreground"
          onClick={() => pick(map.select(r))}
          draggable
          onDragStart={(e) => e.dataTransfer.setData('text/x-loka-room', r.key)}
        >
          {r.key}
        </button>
      ))}
    </div>
  );
}
