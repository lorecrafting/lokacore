// The map's edits (editor-map-and-story-rulings.md, Left to E3b; gui-editor-design §3): each gesture
// as write-route calls (§5.1) in order, undone together. No React or fetch here: the panel passes its
// routes in; tested from kernel/ts/test/author_mapedit.test.ts.
import { placed } from './card.ts';
import type { At, MapRoom } from './map.ts';
import { freeKey, NAMED, nodeOf } from './keys.ts';
export { childKey, freeKey, NAMED, nodeOf } from './keys.ts';
import { addBeat, bind, dropBeat, titleBeat } from './outlineedit.ts';

type Told = { ok: boolean; told: unknown };
export type Io = {
  post: (route: string, sent: object) => Promise<Told>;
  source: (file: string) => Promise<{ bytes: string; sha256: string; kind?: string }>;
};
type Op = { path: (string | number)[]; value?: unknown; delete?: true };
type Exit = { to: string; barrier?: string };
type Doc = { exits?: Record<string, Exit> };
type Row = { room: string } & At;
/** One gesture's write calls: each journals an entry the gesture's undo puts back. */
export type Run = {
  call: (route: string, sent: object) => Promise<{ id: number; files?: string[] }>;
  read: <T>(file: string) => Promise<{ doc: T; was: string }>;
  /** One `/change` of `file` with the ops `edit` builds; none skips it. `was`: the hash they were built on. */
  change: <T>(file: string, edit: (doc: T) => Op[], was?: string) => Promise<void>;
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

/** A drop on an empty map: `bin/loka new layout` writes every room's row, the first sorted at 0,0,0,
 * with the knowledge@1 layout.json needs (lib/loka/content/layout.ex:62). A placed map compiled, so has it. */
const first = (s: Run) => s.call('new', { kind: 'layout', name: 'layout' });

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
  await s.change(file ?? no(`no ${kind}/${key}.json was made`), () => [spot(kind, 'room', r.key)]);
}
/** An NPC's `room` or an item's whole `location` (no old holder stays): holder `kind` `key` (card.ts). */
const spot = (dir: 'npcs' | 'items', kind: string, key: string): Op => {
  const [[field, value]] = Object.entries(placed({}, dir, kind, key));
  return { path: [field], value };
};

/** New <kind> (kernel/ts/play/new.json; `bin/loka new`, its words `~`): an outline or layout has its one
 * fixed name, a NAMED kind the author's `named`, any other a free `<kind>_<n>` (freeKey). Resolves the
 * key made, or '' when a NAMED kind has no name; a refusal throws. */
export async function create(
  io: Io,
  kind: string,
  nodes: { kind: string; ref: string }[],
  templates: string[],
  named = '',
) {
  const one = kind.replace(/(us)es$|s$/, '$1');
  const fixed = kind === 'outline' || kind === 'layout';
  const name = fixed
    ? kind
    : NAMED.includes(kind)
      ? named.trim()
      : freeKey(one, nodeOf(kind), nodes, templates);
  if (!name) return '';
  const { ok, told } = await io.post('new', { kind, name });
  if (!ok) no(said(told));
  if (!(told as { files: string[] }).files.length) no(`${name} already exists`); // the starter reran on its file
  return name;
}

/** Move to area: the file moves to `areas/<area>/rooms/`, or to the root for null. */
const move = async (s: Run, r: MapRoom, area: string | null) =>
  s.call('move', { file: fileOf(r), was: (await s.read(fileOf(r))).was, area });

/** Undoes `ids` newest first, dropping each as it goes, so a refusal leaves only what stands. */
/** Puts back journal `ids`, newest first (popping each); Build's chip after a reload has only these. */
export async function undo(io: Io, ids: number[]) {
  while (ids.length) {
    const r = await io.post('undo', { id: ids.at(-1) });
    if (!r.ok) no(`put back stopped: ${said(r.told)}`);
    ids.pop();
  }
}

type Done = { ids: number[]; files: Set<string> };
/** Runs one gesture's calls in order; a refusal puts back the calls before it, then throws. */
async function gesture(io: Io, done: Done[], steps: (s: Run) => Promise<unknown>) {
  const ids: number[] = [];
  const files = new Set<string>(); // read or written: the rooms whose Undo it is (loka-wfrgk.77)
  const call: Run['call'] = async (route, sent) => {
    const r = await io.post(route, sent);
    if (!r.ok) no(said(r.told));
    const told = r.told as { id: number; files?: string[] };
    ids.push(told.id);
    told.files?.forEach((f) => files.add(f));
    return told;
  };
  const read: Run['read'] = async (file) => {
    const got = await io.source(file);
    files.add(file);
    return { doc: JSON.parse(got.bytes), was: got.sha256 };
  };
  const change: Run['change'] = async (file, edit, was) => {
    const got = await read<never>(file);
    const ops = edit(got.doc);
    if (ops.length) await call('change', { file, was: was ?? got.was, ops }); // a stale `was` is refused
  };
  try {
    await steps({ call, read, change });
  } catch (e) {
    // ponytail: a put-back refused here (a Hold, an outside edit) is reported with the refusal, not retried
    await undo(io, ids).catch((u: Error) => no(`${(e as Error).message}; ${u.message}`));
    throw e;
  }
  if (ids.length) done.push({ ids, files });
}

/** The map's gestures over the panel's routes, and an undo of the last whole gesture. */
export function editor(io: Io) {
  const done: Done[] = []; // each gesture's journal ids and files, oldest first
  const run = (steps: (s: Run) => Promise<unknown>) => gesture(io, done, steps);
  return {
    /** How many gestures Undo can put back: a run that raised it wrote (one on its own cell did not). */
    undoable: () => done.length,
    /** The last gesture's journal ids, oldest first. */
    last: () => [...(done.at(-1)?.ids ?? [])],
    async undo() {
      await undo(io, done.at(-1)?.ids ?? no('no map edit to undo'));
      done.pop();
    },
    /** The last gesture's newest journal id if it read or wrote `file`: a card's Undo runs it when newer than its own. */
    newest: (file: string) => (done.at(-1)?.files.has(file) ? done.at(-1)!.ids.at(-1) : undefined),
    place: (r: MapRoom, at: At) => run((s) => place(s, r, at)),
    first: () => run(first),
    link: (a: MapRoom, dir: string, b: MapRoom, one = false) => run((s) => link(s, a, dir, b, one)),
    unlink: (a: MapRoom, dir: string, rooms: MapRoom[]) => run((s) => unlink(s, a, dir, rooms)),
    oneWay: (a: MapRoom, dir: string, rooms: MapRoom[]) => run((s) => oneWay(s, a, dir, rooms)),
    barrier: (a: MapRoom, dir: string, rooms: MapRoom[], key: string, locked: boolean) =>
      run((s) => barrier(s, a, dir, rooms, key, locked)),
    grow: (a: MapRoom, dir: string, key: string) => run((s) => grow(s, a, dir, key)),
    made: (r: MapRoom, kind: 'npcs' | 'items', key: string, up?: string) =>
      run((s) => made(s, r, kind, key, up)),
    /** Placement (the Person and Item sheets): `file`'s NPC or item now starts in holder `kind` `key`. */
    put: (file: string, dir: 'npcs' | 'items', kind: string, key: string) =>
      run((s) => s.change(file, () => [spot(dir, kind, key)])),
    move: (r: MapRoom, area: string | null) => run((s) => move(s, r, area)),
    /** Each `[file, was, ops]` written in order, as one gesture (a refusal undoes the earlier ones). */
    change: (...writes: [string, string, Op[]][]) =>
      run(async (s) => {
        for (const [file, was, ops] of writes) await s.change(file, () => ops, was);
      }),
    bind: (part: number, n: number, short: string, known: string[]) =>
      run((s) => bind(s, part, n, short, known)),
    addBeat: (part: number, n: number) => run((s) => addBeat(s, part, n)),
    titleBeat: (part: number, n: number, title: string) => run((s) => titleBeat(s, part, n, title)),
    dropBeat: (part: number, n: number) => run((s) => dropBeat(s, part, n)),
  };
}
export type Editor = ReturnType<typeof editor>;
