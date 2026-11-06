// The map's edits (editor-map-and-story-rulings.md, Left to E3b; gui-editor-design §3): each gesture
// as write-route calls (§5.1) in order, undone together. No React or fetch here: the panel passes its
// routes in; tested from kernel/ts/test/author_mapedit.test.ts.
import { M, type At, type MapRoom } from './map.ts';

type Told = { ok: boolean; told: unknown };
export type Io = {
  post: (route: string, sent: object) => Promise<Told>;
  source: (file: string) => Promise<{ bytes: string; sha256: string }>;
};
type Op = { path: (string | number)[]; value?: unknown; delete?: true };
type Exit = { to: string; barrier?: string };
type Doc = { exits?: Record<string, Exit> };
type Row = { room: string } & At;
/** One gesture's write calls: each journals an entry the gesture's undo puts back. */
type Run = {
  call: (route: string, sent: object) => Promise<{ id: number; files?: string[] }>;
  read: <T>(file: string) => Promise<{ doc: T; was: string }>;
  /** One `/change` of `file` with the ops `edit` builds from its current source; none skips it. */
  change: <T>(file: string, edit: (doc: T) => Op[]) => Promise<void>;
};

/** The direction back through an exit (Loka.Content.Barriers.opposite). */
export const BACK: Record<string, string> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
  up: 'down',
  down: 'up',
};

const no = (why: string): never => {
  throw new Error(why);
};
const fileOf = (r: MapRoom) => r.file ?? no(`${r.key} has no source file`);
const back = (dir: string) => BACK[dir] ?? no(`${dir} is not a direction`);
const said = (told: unknown) =>
  typeof told === 'string'
    ? told
    : `${(told as { file?: string })?.file ?? 'a file'} changed since the map read it`;
/** Sets one exit, making `exits` when the room has none. */
const exit = (doc: Doc, dir: string, value: Exit): Op =>
  doc.exits ? { path: ['exits', dir], value } : { path: ['exits'], value: { [dir]: value } };
const faceOf = async (s: Run, a: MapRoom, dir: string) =>
  (await s.read<Doc>(fileOf(a))).doc.exits?.[dir] ?? no(`${a.key} has no exit ${dir}`);
const roomOf = (rooms: MapRoom[], key: string) =>
  rooms.find((r) => r.key === key) ?? no(`${key} is not on the map`);

/** The layout cell under a point of the map's SVG (the inverse of mapdraw.tsx `at`). */
export const cellAt = (v: { zoom: number; x: number; y: number }, p: { x: number; y: number }) => ({
  x: Math.floor((p.x - v.x) / (v.zoom * M.cell)),
  y: Math.floor((p.y - v.y) / (v.zoom * M.cell)),
});
const DRAG = 4; // mutate-skip: px a press moves before it is a drag, uncalibrated design value
/** A press released this far from where it began is a drag; nearer, it is a click (it selects). */
export const dragged = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(b.x - a.x, b.y - a.y) >= DRAG;
/** The compass direction from one cell toward another on the same level: the larger axis wins. */
export function toward(a: At, b: At) {
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  if (a.z !== b.z || (!dx && !dy)) return undefined;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'east' : 'west';
  return dy > 0 ? 'south' : 'north';
}

/** Drag: writes `r`'s layout row (appending one for an unplaced room); a taken cell refuses. */
const place = (s: Run, r: MapRoom, at: At) =>
  s.change<Row[]>('layout.json', (rows) => {
    const taken = rows.find(
      (o) => o.room !== r.key && o.x === at.x && o.y === at.y && o.z === at.z,
    );
    if (taken) no(`${taken.room} is in that cell`);
    const i = rows.findIndex((o) => o.room === r.key);
    const was = rows[i];
    if (was && was.x === at.x && was.y === at.y && was.z === at.z) return []; // its own cell: no write
    return [{ path: [i < 0 ? rows.length : i], value: { room: r.key, ...at } }];
  });

/** Draws an exit `a` → `b` going `dir` and, unless one-way, its reciprocal face. */
async function link(s: Run, a: MapRoom, dir: string, b: MapRoom, oneWay: boolean) {
  const home = back(dir);
  if (a.key === b.key) no('an exit leads to another room');
  const add = (from: MapRoom, way: string, to: string) =>
    s.change<Doc>(fileOf(from), (doc) =>
      doc.exits?.[way] ? no(`${from.key} already has an exit ${way}`) : [exit(doc, way, { to })],
    );
  await add(a, dir, b.key);
  if (!oneWay) await add(b, home, a.key);
}

/** Deletes `a`'s exit `dir` and its reciprocal face, if the room it leads to has one. */
async function unlink(s: Run, a: MapRoom, dir: string, rooms: MapRoom[]) {
  const to = (await faceOf(s, a, dir)).to;
  await s.change(fileOf(a), () => [{ path: ['exits', dir], delete: true }]);
  const b = rooms.find((r) => r.key === to);
  if (b)
    await s.change<Doc>(fileOf(b), (doc) =>
      doc.exits?.[back(dir)]?.to === a.key ? [{ path: ['exits', back(dir)], delete: true }] : [],
    );
}

/** One-way toggle: removes the reciprocal face of `a`'s exit `dir`, or draws it back. */
async function oneWay(s: Run, a: MapRoom, dir: string, rooms: MapRoom[]) {
  const face = await faceOf(s, a, dir);
  if (face.barrier) no(`${face.barrier} needs both faces: take the barrier off first`);
  const b = roomOf(rooms, face.to);
  await s.change<Doc>(fileOf(b), (doc) => {
    const was = doc.exits?.[back(dir)];
    if (!was) return [exit(doc, back(dir), { to: a.key })];
    if (was.to !== a.key) no(`${b.key}'s exit ${back(dir)} leads to ${was.to}`);
    return [{ path: ['exits', back(dir)], delete: true }];
  });
}

/** Barrier drop: a new barrier `key` (`~` words, closed or locked) named on both faces of the exit. */
async function barrier(
  s: Run,
  a: MapRoom,
  dir: string,
  rooms: MapRoom[],
  key: string,
  locked: boolean,
) {
  const face = await faceOf(s, a, dir);
  if (face.barrier) no(`${a.key}'s exit ${dir} already has ${face.barrier}`);
  const b = roomOf(rooms, face.to);
  const reverse = (await s.read<Doc>(fileOf(b))).doc.exits?.[back(dir)];
  if (reverse?.to !== a.key) no('a barrier needs the exit both ways: a one-way exit has none');
  // a barrier is owned: in the rooms' area when they share one, else at the root (border rule)
  const area = a.area === b.area ? a.area : null;
  const made = await s.call('new', { kind: 'barriers', name: key, ...(area ? { area } : {}) });
  const file = made.files?.find((f) => f.endsWith(`barriers/${key}.json`));
  if (locked)
    await s.change(file ?? no(`no barriers/${key}.json was made`), () => [
      { path: ['initial'], value: 'locked' },
    ]);
  await s.change(fileOf(a), () => [{ path: ['exits', dir, 'barrier'], value: key }]);
  await s.change(fileOf(b), () => [{ path: ['exits', back(dir), 'barrier'], value: key }]);
}

/** New room from here: `bin/loka new rooms <key> --from <a> <dir>` (its words `~`), in `a`'s area. */
async function grow(s: Run, a: MapRoom, dir: string, key: string) {
  back(dir);
  if ((await s.read<Doc>(fileOf(a))).doc.exits?.[dir]) no(`${a.key} already has an exit ${dir}`);
  const from = { room: a.key, direction: dir };
  await s.call('new', { kind: 'rooms', name: key, from, ...(a.area ? { area: a.area } : {}) });
}

/** New NPC or item here (`bin/loka new <kind> <key>`, its words `~`), in the room's area, placed in it;
 * with `up`, a child of that template (`--extends`: the engine refuses a crossing or concrete parent). */
async function made(s: Run, r: MapRoom, kind: 'npcs' | 'items', key: string, up?: string) {
  const area = r.area ? { area: r.area } : {};
  const told = await s.call('new', { kind, name: key, ...area, ...(up ? { extends: up } : {}) });
  const file = told.files?.find((f) => f.endsWith(`${kind}/${key}.json`));
  await s.change(file ?? no(`no ${kind}/${key}.json was made`), () => [
    kind === 'npcs'
      ? { path: ['room'], value: r.key }
      : { path: ['location'], value: { in: 'room', room: r.key } },
  ]);
}

/** A dropped template's child key, no name chosen: the first `<template>_<n>` from 1 that no NPC
 * (or item) in the graph and no template holds. */
export function freeKey(t: { dir: 'npcs' | 'items'; key: string }, nodes: { kind: string; ref: string }[], templates: string[]) {
  const kind = t.dir === 'npcs' ? 'npc' : 'item';
  const taken = new Set([...templates, ...nodes.filter((o) => o.kind === kind).map((o) => o.ref.split('/')[1])]);
  let n = 1;
  while (taken.has(`${t.key}_${n}`)) n++;
  return `${t.key}_${n}`;
}

/** The palette's map-npc/map-item answer: `<key>`, or `~<template>` for that template's child at its free key. */
export function childOf(answer: string, dir: 'npcs' | 'items', nodes: { kind: string; ref: string }[], templates: string[]): [string, string?] {
  if (!answer.startsWith('~')) return [answer];
  const up = answer.slice(1);
  return [freeKey({ dir, key: up }, nodes, templates), up];
}

/** Move to area: the file moves to `areas/<area>/rooms/`, or to the root for null. */
const move = async (s: Run, r: MapRoom, area: string | null) =>
  s.call('move', { file: fileOf(r), was: (await s.read(fileOf(r))).was, area });

type Outline = { parts: { beats: { n: number; nodes?: string[] }[] }[] };
/** Bind (design 5c): `short`, one of `known` (Story.shorts), joins beat `n` of part `part` in outline.json. */
const bind = (s: Run, part: number, n: number, short: string, known: string[]) =>
  s.change<Outline>('outline.json', (doc) => {
    if (!known.includes(short)) no(`${short} is no definition in the last compile`);
    const beats = doc.parts[part]?.beats ?? no(`outline.json has no part ${part + 1}`);
    const j = beats.findIndex((b) => b.n === n);
    if (j < 0) no(`part ${part + 1} has no beat ${n}`);
    const nodes = beats[j].nodes ?? [];
    if (nodes.includes(short)) no(`beat ${n} already binds ${short}`);
    return [{ path: ['parts', part, 'beats', j, 'nodes'], value: [...nodes, short] }];
  });

/** Undoes `ids` newest first, dropping each as it goes, so a refusal leaves only what stands. */
async function undo(io: Io, ids: number[]) {
  while (ids.length) {
    const r = await io.post('undo', { id: ids.at(-1) });
    if (!r.ok) no(`put back stopped: ${said(r.told)}`);
    ids.pop();
  }
}

/** Runs one gesture's calls in order; a refusal puts back the calls before it, then throws. */
async function gesture(io: Io, done: number[][], steps: (s: Run) => Promise<unknown>) {
  const ids: number[] = [];
  const call: Run['call'] = async (route, sent) => {
    const r = await io.post(route, sent);
    if (!r.ok) no(said(r.told));
    const told = r.told as { id: number; files?: string[] };
    ids.push(told.id);
    return told;
  };
  const read: Run['read'] = async (file) => {
    const got = await io.source(file);
    return { doc: JSON.parse(got.bytes), was: got.sha256 };
  };
  const change: Run['change'] = async (file, edit) => {
    const { doc, was } = await read<never>(file);
    const ops = edit(doc);
    if (ops.length) await call('change', { file, was, ops });
  };
  try {
    await steps({ call, read, change });
  } catch (e) {
    // ponytail: a put-back refused here (a Hold, an outside edit) is reported with the refusal, not retried
    await undo(io, ids).catch((u: Error) => no(`${(e as Error).message}; ${u.message}`));
    throw e;
  }
  if (ids.length) done.push(ids);
}

/** The map's gestures over the panel's routes, and an undo of the last whole gesture. */
export function editor(io: Io) {
  const done: number[][] = []; // the journal ids of each gesture, oldest first
  const run = (steps: (s: Run) => Promise<unknown>) => gesture(io, done, steps);
  return {
    undoable: () => done.length > 0,
    async undo() {
      await undo(io, done.at(-1) ?? no('no map edit to undo'));
      done.pop();
    },
    place: (r: MapRoom, at: At) => run((s) => place(s, r, at)),
    link: (a: MapRoom, dir: string, b: MapRoom, one = false) => run((s) => link(s, a, dir, b, one)),
    unlink: (a: MapRoom, dir: string, rooms: MapRoom[]) => run((s) => unlink(s, a, dir, rooms)),
    oneWay: (a: MapRoom, dir: string, rooms: MapRoom[]) => run((s) => oneWay(s, a, dir, rooms)),
    barrier: (a: MapRoom, dir: string, rooms: MapRoom[], key: string, locked: boolean) =>
      run((s) => barrier(s, a, dir, rooms, key, locked)),
    grow: (a: MapRoom, dir: string, key: string) => run((s) => grow(s, a, dir, key)),
    made: (r: MapRoom, kind: 'npcs' | 'items', key: string, up?: string) =>
      run((s) => made(s, r, kind, key, up)),
    move: (r: MapRoom, area: string | null) => run((s) => move(s, r, area)),
    bind: (part: number, n: number, short: string, known: string[]) =>
      run((s) => bind(s, part, n, short, known)),
  };
}
export type Editor = ReturnType<typeof editor>;
