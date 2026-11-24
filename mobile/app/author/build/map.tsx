// The Build map (docs/rnd/in-game-builder-mode-2026-11-19.md §4.7, slice 4.2): the /story map's rooms on
// one level as boxes at their cells, exits as lines, the current room marked. A tap selects and never
// plays; Go here and Sheet act on the selection. ⌃ ⌄ step levels; − + ⤢, drag on empty ground, pinch
// and wheel move the view with the panel's math (kernel/ts/play/map.ts, as areamap.tsx's useLevel).
import { Pressable, Text, View } from 'react-native';
import * as map from '../../../../kernel/ts/play/map.ts';
import { M } from '../../../../kernel/ts/play/map.ts';
import { space, type } from '../../book/tokens.ts';
import { ink } from './build.ts';
import { known } from './room.tsx';
import { act, CONTROL, sheets } from './sheet.tsx';

// ponytail: placeholder chrome; the designer words it (the owner writes player-facing words only).
const WORDS = {
  map: 'Map',
  title: (z: number) => `Map · level ${z}`,
  up: { glyph: '⌃', name: 'Level up' },
  down: { glyph: '⌄', name: 'Level down' },
  out: { glyph: '−', name: 'Zoom out' },
  in: { glyph: '+', name: 'Zoom in' },
  fit: { glyph: '⤢', name: 'Fit' },
  unplaced: (n: number) => `Unplaced (${n}):`,
  selected: (key: string) => `${key} — selected`,
  go: 'Go here',
  sheet: 'Sheet',
};

type Point = { x: number; y: number };
let z: number | undefined; // the level stepped to; until then the map follows the current room
let view: { v: map.View; z: number } | undefined; // and the level it shows
let selected: string | undefined;
let box: map.Box = { w: 0, h: 0 };
const down = new Map<number, Point>(); // the pointers held on the ground
let grab: { at: Point[]; v: map.View } | undefined; // the pointers and view when the gesture last changed
let hooks = { go: (_room: string) => {}, here: (): string | undefined => undefined };

const rooms = () => known.rooms;
/** The level shown: the one stepped to while it still has rooms, else the current room's, else the lowest.
 * Not stored: a call before the Book knows its room must not pin the lowest level. */
function level() {
  const all = map.levels(rooms());
  return z !== undefined && all.includes(z) ? z : map.levelOf(rooms(), hooks.here(), all[0] ?? 0);
}
const extent = () => map.bounds(map.onLevel(rooms(), level()));
const fitted = () => map.fit(extent(), box, M.floor);
/** The view, fitted again when the level shown changed under it (the current room took the stairs). */
const seen = () => (view?.z === level() ? view.v : (view = { v: fitted(), z: level() }).v);
const set = (v: map.View) => (
  (view = { v: map.keep(v, extent(), box), z: level() }),
  known.redraw()
);
const centre = (): Point => ({ x: box.w / 2, y: box.h / 2 });
const zoom = (f: number, p = centre(), from = seen()) =>
  set(map.zoomAt(from, f, p, map.least(extent(), box)));
/** Up (+1) or down (-1) a level, fitted. */
function step(by: number) {
  const all = map.levels(rooms());
  const next = all[all.indexOf(level()) + by];
  if (next === undefined) return;
  z = next;
  set(fitted());
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
/** A first pointer on a room is its tap; on the ground, or a second one anywhere, it starts a gesture. */
function press(e: Pe) {
  if (!down.size && e.target !== e.currentTarget) return;
  e.currentTarget.setPointerCapture(e.nativeEvent.pointerId);
  down.set(e.nativeEvent.pointerId, pointer(e.nativeEvent, e.currentTarget));
  regrab();
}
/** One pointer pans; two pinch about their midpoint and pan with it. */
function move(e: Pe) {
  if (!grab || !down.has(e.nativeEvent.pointerId)) return;
  down.set(e.nativeEvent.pointerId, pointer(e.nativeEvent, e.currentTarget));
  const [a, b] = [...down.values()];
  const [a0, b0] = grab.at;
  if (!b || !b0) return set({ ...grab.v, x: grab.v.x + a.x - a0.x, y: grab.v.y + a.y - a0.y });
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const v = {
    ...grab.v,
    x: grab.v.x + mid.x - (a0.x + b0.x) / 2,
    y: grab.v.y + mid.y - (a0.y + b0.y) / 2,
  };
  zoom(Math.hypot(a.x - b.x, a.y - b.y) / Math.hypot(a0.x - b0.x, a0.y - b0.y), mid, v);
}
function lift(e: Pe) {
  down.delete(e.nativeEvent.pointerId);
  if (down.size) regrab();
  else grab = undefined;
}
/** The wheel zooms about the cursor (the panel's factor); React Native Web forwards no onWheel. */
const wheel = (e: WheelEvent) => {
  e.preventDefault();
  zoom(Math.exp(-e.deltaY / 100), pointer(e, e.currentTarget as HTMLElement));
};
/** The ground's ref: the wheel on mount; on unmount, drop a gesture whose pointers never lifted. */
function wheeled(node: HTMLElement | null) {
  if (node) return node.addEventListener('wheel', wheel, { passive: false });
  down.clear();
  grab = undefined;
}

const glyph = (g: { glyph: string; name: string }, run: () => void) => (
  <Pressable
    key={g.name}
    accessibilityRole="button"
    accessibilityLabel={g.name}
    onPress={run}
    style={CONTROL}
  >
    <Text style={{ ...type.control, color: ink('action') }}>{g.glyph}</Text>
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
        top: (p.from.y + p.to.y) / 2 - 1,
        width: len,
        height: 2, // mutate-skip: the exit's stroke; the test checks the bar centres on it
        backgroundColor: ink('line'),
        transform: [{ rotate: `${(Math.atan2(dy, dx) * 180) / Math.PI}deg` }],
      }}
    />
  );
}

type Seen = { v: map.View; here?: string; at: Map<string, map.At> };
/** A room's cell centre on screen. */
const screen = (s: Seen, at: map.At) => {
  const c = map.centre(at);
  return { x: c.x * s.v.zoom + s.v.x, y: c.y * s.v.zoom + s.v.y };
};
const pick = (key: string) => ((selected = key), known.redraw());

function room(s: Seen, r: map.MapRoom) {
  const { x, y } = screen(s, r.at!);
  const [w, h] = [M.w * s.v.zoom, M.h * s.v.zoom];
  const marks = { here: r.key === s.here, selected: r.key === selected };
  return (
    <Pressable
      key={r.key}
      accessibilityRole="button"
      accessibilityLabel={map.name(r, marks)}
      accessibilityState={{ selected: marks.selected }}
      onPress={() => pick(r.key)}
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: ink(marks.selected ? 'action' : 'card'),
        borderWidth: marks.here ? 3 : 1, // mutate-skip: the current room's ring width, placeholder
        borderColor: ink(marks.here ? 'action' : 'dim'),
      }}
    >
      <Text style={{ ...type.label, color: ink(marks.selected ? 'bg' : 'fg') }}>
        {map.label(r.key, s.v.zoom)?.text}
      </Text>
    </Pressable>
  );
}

const resized = (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
  const { width: w, height: h } = e.nativeEvent.layout;
  if (w === box.w && h === box.h) return;
  box = { w, h };
  view = undefined; // seen() fits once the level has rooms
  known.redraw();
};
const GROUND = {
  aspectRatio: 1, // mutate-skip: layout, a square ground
  overflow: 'hidden',
  borderWidth: 1, // mutate-skip: placeholder frame
  borderColor: ink('line'),
  touchAction: 'none', // the page neither scrolls nor zooms under a drag or pinch
} as object;

/** The level's exits and rooms, once the ground has a size. */
function ground(drawn: map.MapRoom[]) {
  const s: Seen | undefined =
    box.w && drawn.length
      ? { v: seen(), here: hooks.here(), at: new Map(drawn.map((r) => [r.key, r.at!])) }
      : undefined;
  return (
    <View
      key="ground"
      ref={wheeled as never}
      onLayout={resized}
      onPointerDown={press as never}
      onPointerMove={move as never}
      onPointerUp={lift as never}
      onPointerCancel={lift as never}
      style={GROUND}
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
function body() {
  if (selected && !rooms().some((r) => r.key === selected)) selected = undefined; // renamed or deleted
  const unplaced = rooms().filter((r) => !r.at);
  return [
    <View key="controls" style={{ ...row, justifyContent: 'flex-end' }}>
      {glyph(WORDS.up, () => step(1))}
      {glyph(WORDS.down, () => step(-1))}
      {glyph(WORDS.out, () => zoom(1 / M.step))}
      {glyph(WORDS.in, () => zoom(M.step))}
      {glyph(WORDS.fit, () => set(fitted()))}
    </View>,
    ground(map.onLevel(rooms(), level())),
    unplaced.length ? (
      <View key="unplaced" style={row}>
        <Text style={{ ...type.label, color: ink('dim') }}>{WORDS.unplaced(unplaced.length)}</Text>
        {unplaced.map((r) =>
          act(r.key, () => pick(r.key), undefined, `unplaced ${r.key}`, r.key === selected),
        )}
      </View>
    ) : null,
    selected ? (
      // mutate-skip: placeholder rule above the bar
      <View key="bar" style={{ borderTopWidth: 1, borderColor: ink('line'), paddingTop: space.sm }}>
        <Text style={{ ...type.label, color: ink('fg'), paddingHorizontal: space.md }}>
          {WORDS.selected(selected)}
        </Text>
        <View style={row}>
          {act(WORDS.go, () => ((z = undefined), hooks.go(selected!)))}
          {act(WORDS.sheet, () => known.open(`room:${selected}`))}
        </View>
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
