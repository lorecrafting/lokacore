// The editor map's rules (docs/design/editor-map-and-story-rulings.md E3a): which rooms a level
// draws, its edges, stubs and hulls, labels, the view's zoom and pan, the arrow keys' next room and
// each room's accessible name. No React here: tested from kernel/ts/test/author_map.test.ts.

/** A room as the map draws it (kernel/ts/play/story.ts `rooms`): `at` is absent when unplaced. */
export type MapRoom = {
  ref: string;
  key: string;
  file?: string;
  area: string | null;
  title: string;
  exits: { dir: string; to: string; barrier?: string; hidden?: boolean }[];
  at?: { x: number; y: number; z: number };
};

/** Drawing constants in px at zoom 1, exempt from the space tokens as DiscoveredMap's are. */
export const M = {
  cell: 64,
  w: 48,
  h: 24,
  char: 7.2, // type.code's mono advance
  inset: 4, // mutate-skip: uncalibrated design value
  disc: 6, // mutate-skip: uncalibrated design value
  stub: 12, // mutate-skip: uncalibrated design value
  tri: 5, // mutate-skip: uncalibrated design value
  tick: 6, // mutate-skip: uncalibrated design value
  lock: 14, // mutate-skip: uncalibrated design value
  plus: 7, // mutate-skip: uncalibrated design value (a grow handle's radius)
  pad: 12, // space.lg
  min: 0.25,
  floor: 0.1, // the map's least zoom when a level fits only below `min` (map rulings, minimum zoom)
  max: 3,
  step: 1.25,
  labels: 1, // labels hide below this zoom
  overview: 0.5, // rooms are discs below this zoom
}; // mutate-skip: uncalibrated design value

export type At = NonNullable<MapRoom['at']>;
export type View = { zoom: number; x: number; y: number };
export type Box = { w: number; h: number };
const VERTICAL = new Set(['up', 'down']);

/** The levels any placed room is on, lowest first. */
export const levels = (rooms: MapRoom[]) =>
  [...new Set(rooms.flatMap((r) => (r.at ? [r.at.z] : [])))].sort((a, b) => a - b);
/** The level to show once `key` is selected: its own, else the one shown. */
export const levelOf = (rooms: MapRoom[], key: string | undefined, z: number) =>
  rooms.find((r) => r.key === key)?.at?.z ?? z;
/** The rooms one level draws, in DOM order: area, then key. */
export const onLevel = (rooms: MapRoom[], z: number) =>
  rooms
    .filter((r) => r.at?.z === z)
    .sort((a, b) => cmp(a.area ?? '', b.area ?? '') || cmp(a.key, b.key));
const cmp = (a: string, b: string) => Number(a > b) - Number(a < b);
const byKey = (a: MapRoom, b: MapRoom) => cmp(a.key, b.key);

export const centre = (at: At) => ({ x: (at.x + 0.5) * M.cell, y: (at.y + 0.5) * M.cell });

/** One line per reciprocal pair on the level, else one per one-way exit; up and down are stubs. */
export function edges(level: MapRoom[]) {
  const on = new Map(level.map((r) => [r.key, r]));
  const seen = new Set<string>();
  const out: { from: string; to: string; oneWay: boolean; barrier?: string; hidden: boolean }[] =
    [];
  for (const r of level)
    for (const e of r.exits) {
      if (VERTICAL.has(e.dir) || !on.has(e.to) || e.to === r.key) continue;
      const back = on.get(e.to)!.exits.find((b) => b.to === r.key && !VERTICAL.has(b.dir));
      const pair = [r.key, e.to].sort().join(' ');
      if (seen.has(pair)) continue; // a reciprocal pair, or a second one-way exit to the same room
      seen.add(pair);
      out.push({
        from: r.key,
        to: e.to,
        oneWay: !back,
        barrier: e.barrier ?? back?.barrier,
        hidden: Boolean(e.hidden || back?.hidden),
      });
    }
  return out;
}

/** Every area id, sorted: its index picks the hue (mod 6), and the seventh on draw dashed. */
export const areas = (rooms: MapRoom[]) =>
  [...new Set(rooms.flatMap((r) => (r.area ? [r.area] : [])))].sort(cmp);

/** One rect per area on the level: its rooms' boxes padded `space.lg`. */
export function hulls(level: MapRoom[], all: string[]) {
  return all.flatMap((area, i) => {
    const mine = level.filter((r) => r.area === area).map((r) => centre(r.at!));
    if (!mine.length) return [];
    const x = Math.min(...mine.map((c) => c.x)) - M.w / 2 - M.pad;
    const y = Math.min(...mine.map((c) => c.y)) - M.h / 2 - M.pad;
    const w = Math.max(...mine.map((c) => c.x)) + M.w / 2 + M.pad - x;
    const h = Math.max(...mine.map((c) => c.y)) + M.h / 2 + M.pad - y;
    return [{ area, x, y, w, h, hue: (i % 6) + 1, dashed: i >= 6 }];
  });
}

/** A room's label at `zoom`: from zoom 1 the key clipped to its box with `…`, else none. */
export function label(key: string, zoom: number) {
  if (zoom < M.labels) return undefined;
  const fits = Math.floor((M.w * zoom - 2 * M.inset) / M.char);
  return { text: key.length <= fits ? key : `${key.slice(0, Math.max(fits - 1, 0))}…` };
}
/** A marked room's pill: where its box shows no whole key; the current room's box draws the pin, not its key. */
export const pill = (key: string, zoom: number, here: boolean) => here || label(key, zoom)?.text !== key;

/** A failed /story that keeps the last map (map ruling: only a refusal replaces it): no answer, or
 * vite's 502 with the watcher down. The watcher's own refusal is its 500 with the sentence. */
export const kept = (e: Error & { status?: number }) => e.status === undefined || e.status >= 502;

const clampZoom = (z: number, min: number) => Math.min(M.max, Math.max(min, z));
const within = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The level's extent: its rooms' cells. */
export function bounds(level: MapRoom[]) {
  const xs = level.map((r) => r.at!.x);
  const ys = level.map((r) => r.at!.y);
  return {
    x0: Math.min(...xs) * M.cell,
    y0: Math.min(...ys) * M.cell,
    x1: (Math.max(...xs) + 1) * M.cell,
    y1: (Math.max(...ys) + 1) * M.cell,
  };
}
type Bounds = ReturnType<typeof bounds>;

/** The whole level centred in `box`, as large as the zoom limits (`min` to 3) allow. */
export function fit(b: Bounds, box: Box, min = M.min): View {
  const zoom = clampZoom(Math.min(box.w / (b.x1 - b.x0), box.h / (b.y1 - b.y0)), min);
  return {
    zoom,
    x: box.w / 2 - (zoom * (b.x0 + b.x1)) / 2,
    y: box.h / 2 - (zoom * (b.y0 + b.y1)) / 2,
  };
}

/** `v` moved the least that keeps one cell of the level inside `box`. */
export function keep(v: View, b: Bounds, box: Box): View {
  const c = M.cell * v.zoom;
  return {
    zoom: v.zoom,
    x: within(v.x, c - b.x1 * v.zoom, box.w - c - b.x0 * v.zoom),
    y: within(v.y, c - b.y1 * v.zoom, box.h - c - b.y0 * v.zoom),
  };
}

/** The map's minimum zoom: `min`, or the level's fit in `box` where that is less, down to `floor`. */
export const least = (b: Bounds, box: Box) => Math.min(M.min, fit(b, box, M.floor).zoom);

/** Zoom by `factor` about the screen point `p`, within `min` to 3. */
export function zoomAt(v: View, factor: number, p: { x: number; y: number }, min = M.min): View {
  const zoom = clampZoom(v.zoom * factor, Math.min(min, v.zoom)); // a view under `min` only zooms in
  const k = zoom / v.zoom;
  return { zoom, x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k };
}

/** `v` unchanged when the room's centre is on screen, else centred on it. */
export function show(v: View, box: Box, at: At): View {
  const c = centre(at);
  const [sx, sy] = [c.x * v.zoom + v.x, c.y * v.zoom + v.y];
  if (sx >= 0 && sx <= box.w && sy >= 0 && sy <= box.h) return v;
  return { zoom: v.zoom, x: box.w / 2 - c.x * v.zoom, y: box.h / 2 - c.y * v.zoom };
}

/** Each arrow key's offset turned to (ahead, aside); layout y grows south. */
const ARROW: Record<string, (x: number, y: number) => [number, number]> = {
  ArrowRight: (x, y) => [x, y],
  ArrowLeft: (x, y) => [-x, y],
  ArrowUp: (x, y) => [-y, x],
  ArrowDown: (x, y) => [y, x],
};
/** The arrow key's next room: the nearest on the level within 45° of its direction (ties by key). */
export function nearest(level: MapRoom[], from: MapRoom, key: string) {
  let [best, far] = [undefined as MapRoom | undefined, Infinity];
  for (const r of [...level].sort(byKey)) {
    const [ahead, aside] = ARROW[key](r.at!.x - from.at!.x, r.at!.y - from.at!.y);
    const d = Math.hypot(ahead, aside);
    if (!d || ahead < Math.abs(aside)) continue; // within 45°: cells are integers, so exact
    if (d < far) [best, far] = [r, d];
  }
  return best;
}

/** Tab's way in: the selected room on the level, else the current one, else the first by key. */
export const entry = (level: MapRoom[], selected?: string, here?: string) =>
  level.find((r) => r.key === selected) ??
  level.find((r) => r.key === here) ??
  [...level].sort(byKey)[0];

export type Marks = { unreached?: boolean; locked?: boolean; here?: boolean; selected?: boolean };
/** A room's accessible name: key, title, area, level, every exit, then its marks. */
export function name(r: MapRoom, m: Marks) {
  const exits = r.exits.map((e) => `${e.dir} to ${e.to}`).join(', ');
  return [
    r.key,
    r.title,
    r.area,
    r.at && `level ${r.at.z}`,
    exits && `exits: ${exits}`,
    m.unreached && 'unreached',
    m.locked && 'behind a lock',
    m.here && 'here',
    m.selected && 'selected',
  ]
    .filter(Boolean)
    .join(', ');
}

/** The footer: rooms, areas, unreached, behind lock, unplaced; a zero count is left out. */
export function footer(rooms: MapRoom[], unreached: Set<string>, locked: Set<string>) {
  const n = (count: number, one: string, many = one) =>
    count ? `${count} ${count === 1 ? one : many}` : '';
  return [
    n(rooms.length, 'room', 'rooms'),
    n(areas(rooms).length, 'area', 'areas'),
    n(rooms.filter((r) => unreached.has(r.ref)).length, 'unreached'),
    n(rooms.filter((r) => locked.has(r.ref)).length, 'behind lock'),
    n(rooms.filter((r) => !r.at).length, 'unplaced'),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The shared selection a room click makes (the hierarchy and Book follow it). */
export const select = (r: MapRoom) => ({ file: r.file, kind: 'room', key: r.key });

/** The cell one step away, as `templates.ex` places a grown room (north is -y). */
export const STEP: Record<string, [number, number, number]> = {
  north: [0, -1, 0],
  east: [1, 0, 0],
  south: [0, 1, 0],
  west: [-1, 0, 0],
  up: [0, 0, 1],
  down: [0, 0, -1],
};
/** The sides a room can grow from: no exit that way (grow refuses one) and no placed room on
 * the target cell (the server would set the new room elsewhere on that level). */
export function grows(r: MapRoom, rooms: MapRoom[]) {
  const at = r.at;
  if (!at) return [];
  const held = new Set(rooms.flatMap((o) => (o.at ? [`${o.at.x},${o.at.y},${o.at.z}`] : [])));
  return Object.entries(STEP)
    .filter(([dir, [x, y, z]]) => !r.exits.some((e) => e.dir === dir) && !held.has(`${at.x + x},${at.y + y},${at.z + z}`))
    .map(([dir]) => dir);
}
