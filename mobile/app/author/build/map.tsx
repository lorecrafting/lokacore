// size: allow 450, the level's view, its gestures, its edits and its drawing share the sheet's module state
// The Build map (docs/rnd/in-game-builder-mode-2026-11-19.md §4.7, slice 4.2): the /story map's rooms on
// one level as boxes at their cells, exits as lines, the current room marked. A tap selects and never
// plays; Go here and Sheet act on the selection. ⌃ ⌄ step levels; − + ⤢, drag on empty ground, pinch
// and wheel move the view with the panel's math (kernel/ts/play/map.ts, as areamap.tsx's useLevel).
// Slice 4.3: ＋, Join…, Move…, a tap placing an unplaced room, Area…: roomedit's `ed`, one Undo each.
import { useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import * as map from '../../../../kernel/ts/play/map.ts';
import { M } from '../../../../kernel/ts/play/map.ts';
import { freeKey } from '../../../../kernel/ts/play/mapedit.ts';
import { size, space, type } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { known } from './room.tsx';
import { ed, moveTo, refusal, run } from './roomedit.tsx';
import { act, CONTROL, DOCK, sheets } from './sheet.tsx';

// ponytail: placeholder chrome; the designer words it (the owner writes player-facing words only).
const WORDS = {
  map: 'Map',
  title: (z: number) => `Map · level ${z}`,
  // ponytail: `drop` moves each chevron's ink to the row's (− + ⤢) ink centre, measured in the web
  // Book's fallback font; re-measure if the control font changes.
  up: { glyph: '⌃', name: 'Level up', drop: 4.5 },
  down: { glyph: '⌄', name: 'Level down', drop: -2.7 },
  out: { glyph: '−', name: 'Zoom out' },
  in: { glyph: '+', name: 'Zoom in' },
  fit: { glyph: '⤢', name: 'Fit' },
  unplaced: (n: number) => `Unplaced (${n}):`,
  selected: (key: string) => `${key} — selected`,
  go: 'Go here',
  sheet: 'Sheet',
  grow: (dir: string) => `New room ${dir}`,
  plus: '＋',
  growAct: (dir: string) => `＋ ${dir}`,
  join: 'Join…',
  move: 'Move…',
  area: 'Area…',
  cancel: 'Cancel',
  joining: (key: string) => `${key} — tap a room to join`,
  moving: (key: string) => `${key} — tap an empty cell`,
  self: 'Tap another room to join',
};

type Point = { x: number; y: number };
/** The least zoom: a cell a touch target wide, so each room's target (its cell) is one and none overlap. */
const LEAST = size.touch / M.cell;
const SLOP = size.touch / 4; // a tap's slop, as the sheet's Grip
let z: number | undefined; // the level stepped to; until then the map follows the current room
let view: { v: map.View; z: number } | undefined; // and the level it shows
const PICKED = 'loka-build-map'; // the selection, kept across the reload a structural compile brings
let selected = globalThis.localStorage?.getItem(PICKED) || undefined;
let mode: 'join' | 'move' | 'area' | undefined; // Join…, Move… or Area… on the selection
let born: string | undefined; // the room ＋ just made, selected before /story has it
export const unborn = () => void (born = undefined); // its gesture put back
let box: map.Box = { w: 0, h: 0 };
const down = new Map<number, Point>(); // the pointers held on the ground
let grab: { at: Point[]; v: map.View } | undefined; // the pointers and view when the gesture last changed
let panned = false; // the held press moved past a tap's slop: the room under it selects nothing
let paint = () => {}; // the drawing's own redraw: a drag or pinch redraws the map, not the Book
let hooks = { go: (_room: string) => {}, here: (): string | undefined => undefined };

const rooms = () => known.rooms;
const chosen = () => rooms().find((r) => r.key === selected);
/** The level shown: the one stepped to while it still has rooms, else the current room's, else the lowest.
 * Not stored: a call before the Book knows its room must not pin the lowest level. */
function level() {
  const all = map.levels(rooms());
  return z !== undefined && all.includes(z) ? z : map.levelOf(rooms(), hooks.here(), all[0] ?? 0);
}
const extent = () => map.bounds(map.onLevel(rooms(), level()));
/** The level fitted; one too big at LEAST is shown at it, centred on the current room when it is there. */
function fitted() {
  const b = extent();
  const at = map.onLevel(rooms(), level()).find((r) => r.key === hooks.here())?.at;
  if (!at || map.fit(b, box, 0).zoom >= LEAST) return map.fit(b, box, LEAST);
  const c = map.centre(at);
  return { zoom: LEAST, x: box.w / 2 - c.x * LEAST, y: box.h / 2 - c.y * LEAST };
}
/** The view, fitted again when the level shown changed under it (the current room took the stairs). */
const seen = () => (view?.z === level() ? view.v : (view = { v: fitted(), z: level() }).v);
const set = (v: map.View) => ((view = { v: map.keep(v, extent(), box), z: level() }), paint());
const centre = (): Point => ({ x: box.w / 2, y: box.h / 2 });
const zoom = (f: number, p = centre(), from = seen()) => set(map.zoomAt(from, f, p, LEAST));
/** Up (+1) or down (-1) a level; seen() fits it. The Book redraws: the title is the frame's. */
function step(by: number) {
  const all = map.levels(rooms());
  z = all[all.indexOf(level()) + by];
  known.redraw();
}

type Ground = { getBoundingClientRect: () => { left: number; top: number } };
/** A pointer on the ground's surface (a room's own offsets would be the room's). */
const pointer = (e: { clientX: number; clientY: number }, on: Ground): Point => {
  const r = on.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};
const regrab = () => (grab = { at: [...down.values()], v: seen() });
type Pe = {
  nativeEvent: { pointerId: number; clientX: number; clientY: number };
  target: unknown;
  currentTarget: Ground & { setPointerCapture: (id: number) => void };
};
/** Every pointer is held; none is captured yet, so a room under a tap still gets its press. */
function press(e: Pe) {
  if (!down.size) panned = false;
  down.set(e.nativeEvent.pointerId, pointer(e.nativeEvent, e.currentTarget));
  regrab();
}
/** Past a tap's slop (or with two pointers) one pointer pans; two pinch about their midpoint. */
function move(e: Pe) {
  const id = e.nativeEvent.pointerId;
  if (!grab || !down.has(id)) return;
  const p = pointer(e.nativeEvent, e.currentTarget);
  const [a0, b0] = grab.at as [Point, Point]; // as many as held: press and lift regrab
  if (!panned && !b0 && Math.hypot(p.x - a0.x, p.y - a0.y) < SLOP) return; // still a tap
  if (!panned) for (const held of down.keys()) e.currentTarget.setPointerCapture(held);
  panned = true;
  down.set(id, p);
  const [a, b] = [...down.values()];
  if (!b) return set({ ...grab.v, x: grab.v.x + a.x - a0.x, y: grab.v.y + a.y - a0.y });
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const v = {
    ...grab.v,
    x: grab.v.x + mid.x - (a0.x + b0.x) / 2,
    y: grab.v.y + mid.y - (a0.y + b0.y) / 2,
  };
  zoom(Math.hypot(a.x - b.x, a.y - b.y) / Math.hypot(a0.x - b0.x, a0.y - b0.y), mid, v);
}
function lift(e: Pe, cancelled = false) {
  const tap = !cancelled && !panned && down.size === 1;
  down.delete(e.nativeEvent.pointerId);
  if (down.size) regrab();
  else grab = undefined;
  if (tap) put(pointer(e.nativeEvent, e.currentTarget));
}
/** A tap on an empty cell, in Move… or with an unplaced room selected, sets the room there; on an
 * empty map it lays every room out (mapedit `first`, as the panel's drop). A room takes its own tap. */
function put(p: Point) {
  const r = chosen();
  if (!r || (r.at && mode !== 'move')) return;
  const at = { ...map.cellAt(seen(), p), z: level() };
  if (map.onLevel(rooms(), at.z).some((o) => o.at!.x === at.x && o.at!.y === at.y)) return;
  mode = undefined;
  void run(() => (rooms().some((o) => o.at) ? ed.place(r, at) : ed.first()));
}
/** The wheel zooms about the cursor (the panel's factor); React Native Web forwards no onWheel. */
const wheel = (e: WheelEvent) => {
  e.preventDefault();
  zoom(Math.exp(-e.deltaY / 100), pointer(e, e.currentTarget as HTMLElement));
};
/** The ground's ref: the wheel on mount; on unmount, drop a gesture whose pointers never lifted. */
function wheeled(node: HTMLElement | null) {
  if (node)
    return (
      node.addEventListener('wheel', wheel, { passive: false }),
      addEventListener('keydown', esc)
    );
  removeEventListener('keydown', esc);
  down.clear();
  grab = mode = undefined; // a mode left open ends with the sheet
}

/** A control glyph; without `run` it is disabled, in `dim`. */
const glyph = (g: { glyph: string; name: string; drop?: number }, run?: () => void) => (
  <Pressable
    key={g.name}
    accessibilityRole="button"
    accessibilityLabel={g.name}
    accessibilityState={{ disabled: !run }}
    disabled={!run}
    onPress={run}
    style={CONTROL}
  >
    <Text
      style={{
        ...type.control,
        color: ink(run ? 'action' : 'dim'),
        transform: [{ translateY: g.drop ?? 0 }],
      }}
    >
      {g.glyph}
    </Text>
  </Pressable>
);

/** An exit as a rotated bar between two room centres on screen (MapDrawing.tsx's Line). */
function Line(p: { from: Point; to: Point }) {
  const [dx, dy] = [p.to.x - p.from.x, p.to.y - p.from.y];
  const len = Math.hypot(dx, dy);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: (p.from.x + p.to.x) / 2 - len / 2,
        top: (p.from.y + p.to.y) / 2 - size.rule / 2,
        width: len,
        height: size.rule,
        backgroundColor: ink('dim'), // Map's line: `line` is under 3:1 on `card`
        transform: [{ rotate: `${(Math.atan2(dy, dx) * 180) / Math.PI}deg` }],
      }}
    />
  );
}

const CENTRED = { justifyContent: 'center', alignItems: 'center' } as const;
type Seen = { v: map.View; here?: string; at: Map<string, map.At> };
/** A room's cell centre on screen. */
const screen = (s: Seen, at: map.At) => {
  const c = map.centre(at);
  return { x: c.x * s.v.zoom + s.v.x, y: c.y * s.v.zoom + s.v.y };
};
const pick = (key: string) => ((selected = key), (mode = undefined), known.redraw());
const cancel = () => ((mode = undefined), known.redraw());
/** Esc leaves Join…, Move… or Area… writing nothing, as Cancel does. */
const esc = (e: KeyboardEvent) => e.key === 'Escape' && mode && cancel();
/** Join… then a tap on `b`: an exit from the selection toward it and the way back (the panel's Shift-drag). */
function join(b: map.MapRoom) {
  const a = chosen()!;
  const dir = map.toward(a.at!, b.at!);
  mode = undefined;
  void run(async () => (dir ? ed.link(a, dir, b) : WORDS.self));
}
/** ＋: a new room `dir` of `r` (`room_<n>`, its words `~`), selected. */
const grow = (r: map.MapRoom, dir: string) =>
  void run(async () => {
    const key = freeKey('room', 'room', known.nodes, []);
    await ed.grow(r, dir, key);
    born = selected = key;
  });
/** ＋ on each free side of the selection on this level, a cell-wide target in the empty cell. */
function plusses(s: Seen) {
  const r = chosen();
  if (mode || !r?.at || r.at.z !== level()) return null;
  const cell = M.cell * s.v.zoom;
  return map
    .grows(r, rooms())
    .filter((dir) => !map.STEP[dir]![2])
    .map((dir) => {
      const [dx, dy] = map.STEP[dir]!;
      const { x, y } = screen(s, { ...r.at!, x: r.at!.x + dx, y: r.at!.y + dy });
      return (
        <Pressable
          key={`grow ${dir}`}
          accessibilityRole="button"
          accessibilityLabel={WORDS.grow(dir)}
          onPress={() => panned || grow(r, dir)}
          style={{
            ...CENTRED,
            position: 'absolute',
            left: x - cell / 2, // mutate-skip: layout; the target centres on its cell
            top: y - cell / 2, // mutate-skip: layout
            width: cell,
            height: cell,
          }}
        >
          <Text style={{ ...type.control, color: ink('action') }}>{WORDS.plus}</Text>
        </Pressable>
      );
    });
}

/** A room: its button is its whole cell (at LEAST a touch target), its box drawn centred in it. */
function room(s: Seen, r: map.MapRoom) {
  const { x, y } = screen(s, r.at!);
  const cell = M.cell * s.v.zoom;
  const marks = { here: r.key === s.here, selected: r.key === selected };
  return (
    <Pressable
      key={r.key}
      accessibilityRole="button"
      accessibilityLabel={map.name(r, marks)}
      accessibilityState={{ selected: marks.selected }}
      onPress={() => panned || (mode === 'join' ? join(r) : mode === 'move' || pick(r.key))}
      style={{
        ...CENTRED,
        position: 'absolute',
        left: x - cell / 2, // mutate-skip: layout; the target centres on its cell
        top: y - cell / 2, // mutate-skip: layout
        width: cell,
        height: cell,
      }}
    >
      <View
        style={{
          ...CENTRED,
          width: M.w * s.v.zoom,
          height: M.h * s.v.zoom,
          backgroundColor: ink(marks.selected ? 'action' : 'card'),
          borderWidth: marks.here ? size.speechBar : size.rule, // the ring is Map's
          borderColor: ink(marks.here ? (marks.selected ? 'fg' : 'action') : 'dim'),
        }}
      >
        <Text style={{ ...type.label, color: ink(marks.selected ? 'bg' : 'fg') }}>
          {map.label(r.key, s.v.zoom)?.text}
        </Text>
      </View>
    </Pressable>
  );
}

const resized = (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
  const { width: w, height: h } = e.nativeEvent.layout;
  if (w === box.w && h === box.h) return;
  box = { w, h };
  view = undefined; // seen() fits once the level has rooms
  paint();
};
/** A phone sheet's height around the ground at half height: its top rule, the grip, Back and the
 * title over the controls; under it the selection bar's rule, gap, words and acts. */
const CHROME =
  size.rule +
  size.touch +
  size.touch +
  type.control.lineHeight +
  size.touch +
  (size.rule + space.sm + type.label.lineHeight + size.touch);
// ponytail: Build.tsx's strip at one row; a wrapped strip (Hold, Undo) shrinks the sheet further.
const STRIP = size.touch + size.rule;
const GROUND = {
  aspectRatio: 1, // mutate-skip: layout, a square ground (capped by height on a phone)
  overflow: 'hidden',
  borderWidth: size.rule,
  borderColor: ink('line'),
  touchAction: 'none', // the page neither scrolls nor zooms under a drag or pinch
} as object;

/** The level's exits and rooms, once the ground has a size. A component: a gesture redraws only it.
 * On a phone it is never so tall that the selection bar falls below the half-height sheet. */
function Drawing({ drawn }: { drawn: map.MapRoom[] }) {
  const [, bump] = useState(0); // mutate-skip: any start value redraws the same
  paint = () => bump((n) => n + 1);
  const window = useWindowDimensions();
  const s: Seen | undefined =
    box.w && drawn.length
      ? { v: seen(), here: hooks.here(), at: new Map(drawn.map((r) => [r.key, r.at!])) }
      : undefined;
  return (
    <View
      ref={wheeled as never}
      onLayout={resized}
      onPointerDown={press as never}
      onPointerMove={move as never}
      onPointerUp={lift as never}
      onPointerCancel={((e: Pe) => lift(e, true)) as never}
      style={
        window.width >= DOCK.at
          ? GROUND
          : { ...GROUND, maxHeight: (window.height - STRIP) / 2 - CHROME }
      }
    >
      {s &&
        map
          .edges(drawn)
          .map((e) => (
            <Line
              key={`${e.from} ${e.to}`}
              from={screen(s, s.at.get(e.from)!)}
              to={screen(s, s.at.get(e.to)!)}
            />
          ))}
      {s && drawn.map((r) => room(s, r))}
      {s && plusses(s)}
    </View>
  );
}

// mutate-skip: layout; rows pad their edges as seeas.tsx's ROW
const row = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space.md,
  paddingHorizontal: space.md,
} as const;
const BAR = {
  borderTopWidth: size.rule,
  borderColor: ink('line'),
  paddingTop: space.sm,
};
/** The selection's words and acts, or the open mode's; a just-grown room: Go here and Sheet only. */
function bar(r: map.MapRoom | undefined) {
  const words =
    mode === 'join'
      ? WORDS.joining
      : mode === 'move' || (r && !r.at)
        ? WORDS.moving
        : WORDS.selected;
  const free = r ? map.grows(r, rooms()).filter((dir) => map.STEP[dir]![2]) : [];
  return (
    <View key="bar" style={BAR}>
      <Text style={{ ...type.label, color: ink('fg'), paddingHorizontal: space.md }}>
        {words(selected!)}
      </Text>
      {mode === 'area' && moveTo(r!)}
      <View style={row}>
        {mode
          ? act(WORDS.cancel, cancel)
          : [
              act(WORDS.go, () => ((z = undefined), hooks.go(selected!))),
              act(WORDS.sheet, () => known.open(`room:${selected}`)),
              r?.at?.z === level() && act(WORDS.join, () => ((mode = 'join'), known.redraw())),
              r?.at && act(WORDS.move, () => ((mode = 'move'), known.redraw())),
              r && act(WORDS.area, () => ((mode = 'area'), known.redraw())),
              ...free.map((dir) => act(WORDS.growAct(dir), () => grow(r!, dir))),
            ]}
      </View>
    </View>
  );
}
function body() {
  if (rooms().some((r) => r.key === born)) born = undefined;
  if (selected && selected !== born && rooms().length && !rooms().some((r) => r.key === selected))
    selected = undefined; // renamed or deleted
  localStorage.setItem(PICKED, selected ?? '');
  const unplaced = rooms().filter((r) => !r.at);
  const all = map.levels(rooms());
  const at = all.indexOf(level());
  return [
    refusal(),
    <View key="controls" style={{ ...row, justifyContent: 'flex-end' }}>
      {all.length > 1 && [
        glyph(WORDS.up, at < all.length - 1 ? () => step(1) : undefined),
        glyph(WORDS.down, at > 0 ? () => step(-1) : undefined),
      ]}
      {glyph(WORDS.out, () => zoom(1 / M.step))}
      {glyph(WORDS.in, () => zoom(M.step))}
      {glyph(WORDS.fit, () => set(fitted()))}
    </View>,
    <Drawing key="ground" drawn={map.onLevel(rooms(), level())} />,
    selected ? bar(chosen()) : null,
    unplaced.length ? (
      <View key="unplaced" style={row}>
        <Text style={{ ...type.label, color: ink('dim') }}>{WORDS.unplaced(unplaced.length)}</Text>
        {unplaced.map((r) =>
          act(r.key, () => pick(r.key), undefined, `unplaced ${r.key}`, r.key === selected),
        )}
      </View>
    ) : null,
  ];
}

/** Registers the map sheet; Build.tsx hands in Go here (start in the room) and the Book's room. */
export function mapSheet(given: typeof hooks) {
  hooks = given;
  sheets.map = { title: () => WORDS.title(level()), body };
}

export { WORDS as MAP };
