// size: allow 540, one scaffolded cartridge the tests edit in turn and the last undoes; a split needs a second scaffold
// The editor map's edits (tools/author-panel/src/mapedit.ts) through the real write routes
// (play/write.ts) and the real `mix loka.new`, on one scaffolded cartridge the tests edit in turn;
// the last one undoes every gesture. Expected files are written by hand.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { after, before, test } from 'node:test';
import { added } from '../play/card.ts';
import { paired } from '../play/action.ts';
import { serve } from '../play/live.ts';
import type { MapRoom } from '../../../tools/author-panel/src/map.ts';
import {
  cellAt,
  editor,
  childKey,
  freeKey,
  toward,
  dragged,
  type Editor,
  type Io,
} from '../../../tools/author-panel/src/mapedit.ts';

const REPO = join(import.meta.dirname, '../../..');
const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loka-mapedit-')));
const src = join(dir, 'src');
const read = (rel: string) => readFileSync(join(src, rel), 'utf8');
const json = (rel: string) => JSON.parse(read(rel));
const files = (at = src): string[] =>
  readdirSync(at, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(at, e.name)) : [relative(src, join(at, e.name))],
  );
const room = (key: string, file = `rooms/${key}.json`, area: string | null = null): MapRoom => ({
  ref: key,
  key,
  file,
  area,
  title: key,
  exits: [],
});
const [start, b, cellar] = [room('start'), room('b'), room('cellar')];
let c = room('c');
const rooms = () => [start, b, c, cellar];
let ed: Editor;
let close = () => {};
let ask: (path: string) => Promise<{ ok: boolean; told: any }>;
let snapshot: Record<string, string>;
let io: Io;

const open = async (at: string) => {
  const live = serve(0, at, join(dir, 'none.json'));
  const port = await live.port;
  const http = (path: string, sent?: object) =>
    new Promise<{ ok: boolean; told: any }>((done, fail) => {
      const method = sent ? 'POST' : 'GET';
      const req = request({ port, path, method, headers: { host: `localhost:${port}` } });
      req.on('error', fail).on('response', async (res) => {
        let text = '';
        for await (const chunk of res) text += chunk;
        const told = res.headers['content-type'] ? JSON.parse(text) : text;
        done({ ok: res.statusCode === 200, told });
      });
      req.end(sent && JSON.stringify(sent));
    });
  const io: Io = {
    post: (route, sent) => http(`/${route}`, sent),
    source: async (file) => (await http(`/source?file=${encodeURIComponent(file)}`)).told,
  };
  return { close: () => live.close(), http, io };
};

before(async () => {
  // CI has mix but no mise: the stub runs the command (as ci.yml's kernel job does)
  mkdirSync(join(dir, 'bin'));
  writeFileSync(join(dir, 'bin/mise'), '#!/bin/sh\nshift 2\nexec "$@"\n');
  chmodSync(join(dir, 'bin/mise'), 0o755);
  process.env.PATH = `${join(dir, 'bin')}:${process.env.PATH}`;
  execFileSync('mix', ['loka.new', 'cartridge', src], { cwd: REPO, stdio: 'ignore' });
  const blank = read('rooms/start.json');
  writeFileSync(join(src, 'rooms/b.json'), blank);
  writeFileSync(join(src, 'rooms/c.json'), blank);
  writeFileSync(
    join(src, 'outline.json'),
    '{ "parts": [{ "beats": [{ "n": 1 }, { "n": 2, "nodes": ["rooms/b"] }] }] }\n',
  );
  snapshot = Object.fromEntries(files().map((f) => [f, read(f)]));
  ({ close, http: ask, io } = await open(src));
  ed = editor(io);
});
after(() => {
  close();
  rmSync(dir, { recursive: true, force: true });
});

test('a drag writes the layout cell, appends an unplaced room, and refuses a taken cell', async () => {
  // Breaks: a drag appending a second row for a placed room; an unplaced room not getting one;
  // two rooms put in one cell.
  await ed.place(b, { x: 1, y: 0, z: 0 });
  await ed.place(start, { x: 0, y: 1, z: 0 });
  await assert.rejects(ed.place(b, { x: 0, y: 1, z: 0 }), /start is in that cell/);
  assert.deepEqual(json('layout.json'), [
    { room: 'start', x: 0, y: 1, z: 0 },
    { room: 'b', x: 1, y: 0, z: 0 },
  ]);
});

test("a drop on the room's own cell writes nothing", async () => {
  // Breaks: the drop writing its identical layout row (a recompile and an undo step for nothing).
  let posts = 0;
  const counted = editor({ ...io, post: (route, sent) => (posts++, io.post(route, sent)) });
  await counted.place(start, { x: 0, y: 1, z: 0 });
  assert.equal(posts, 0);
});

test('an exit draw writes both faces, a one-way draw one, and a refused draw puts its first face back', async () => {
  // Breaks: the reciprocal face missing or in the wrong direction; a one-way draw writing it; a
  // second face refused (taken) leaving the first face written; one-way toggling the wrong face.
  await ed.link(start, 'east', b);
  await ed.link(start, 'north', c, true);
  assert.deepEqual(json('rooms/start.json').exits, { east: { to: 'b' }, north: { to: 'c' } });
  assert.deepEqual(json('rooms/b.json').exits, { west: { to: 'start' } });
  assert.deepEqual(json('rooms/c.json').exits, {});
  const before = read('rooms/c.json');
  await assert.rejects(ed.link(c, 'east', b), /b already has an exit west/);
  assert.equal(read('rooms/c.json'), before);
  await ed.oneWay(start, 'east', rooms());
  assert.deepEqual(json('rooms/b.json').exits, {});
  await ed.oneWay(start, 'east', rooms());
  assert.deepEqual(json('rooms/b.json').exits, { west: { to: 'start' } });
});

test('a delete removes both faces, but not a face that leads elsewhere', async () => {
  // Breaks: the reciprocal face left behind; another exit of the far room deleted with it.
  await ed.unlink(start, 'east', rooms());
  assert.deepEqual(json('rooms/b.json').exits, {});
  await ed.link(c, 'south', b, true);
  await ed.unlink(start, 'north', rooms());
  assert.deepEqual(json('rooms/start.json').exits, {});
  assert.deepEqual(json('rooms/c.json').exits, { south: { to: 'b' } });
});

test('new room from here makes a ~ room linked both ways and placed beside it', async () => {
  // Breaks: the new room's words written by the tool; the back link or the from-room's exit
  // missing; the room left off the layout.
  await ed.grow(start, 'south', 'cellar');
  const made = json('rooms/cellar.json');
  assert.deepEqual([made.name, made.description], [{ prose: '~' }, { prose: '~' }]);
  assert.deepEqual(made.exits, { north: { to: 'start' } });
  assert.deepEqual(json('rooms/start.json').exits, { south: { to: 'cellar' } });
  assert.deepEqual(json('layout.json')[2], { room: 'cellar', x: 0, y: 2, z: 0 });
  // Break: the new room's own card cannot Undo its making (review 683 nit 2, mapedit.ts told.files)
  const id = ed.newest('rooms/cellar.json');
  assert.ok(id !== undefined && id === ed.newest('rooms/start.json'));
  await assert.rejects(ed.grow(start, 'south', 'cellar2'), /start already has an exit south/);
  // Breaks: the server's own refusal text replaced by the stale-file message
  await assert.rejects(ed.grow(start, 'west', 'Cellar'), /kind, name, area/);
});

test('new room from here keys the room room_<n> past a compiled room_1, linked both ways', async () => {
  // Breaks: a compiled room's key reused (the starter refuses the room), or the key not room_<n>.
  const key = freeKey('room', 'room', [{ kind: 'room', ref: 'cart@0:room/room_1' }], []);
  await ed.grow(b, 'east', key);
  assert.deepEqual(json('rooms/room_2.json').exits, { west: { to: 'b' } });
  assert.deepEqual(json('rooms/b.json').exits.east, { to: 'room_2' });
});

test('move to area moves the file and the cartridge still compiles', async () => {
  // Breaks: the file copied rather than moved, or put outside `areas/<area>/rooms/`.
  await ed.move(c, 'yard');
  c = room('c', 'areas/yard/rooms/c.json', 'yard');
  assert.equal(existsSync(join(src, 'rooms/c.json')), false);
  assert.deepEqual(json(c.file!).exits, { south: { to: 'b' } });
  const out = join(dir, 'out.json');
  const compiled = spawnSync('mix', ['loka.compile', src, out, '--allow-placeholders'], {
    cwd: REPO,
    encoding: 'utf8',
  });
  assert.equal(compiled.status, 0, compiled.stderr);
});

test("an NPC given hp by the card's Add compiles", () => {
  // Breaks: Add hp seeded at the schema's least value (BODY_BELOW_ZERO, resources.ex), so a
  // combat NPC always starts from a file the compiler refuses.
  const defs = JSON.parse(
    readFileSync(join(REPO, 'schemas/source/defs.schema.json'), 'utf8'),
  ).$defs;
  const [prose, room] = [{ prose: '~' }, 'start'];
  const ox = { keywords: ['ox'], name: prose, description: prose, room_line: prose, room };
  mkdirSync(join(src, 'npcs'));
  writeFileSync(
    join(src, 'npcs/ox.json'),
    JSON.stringify(added(ox, 'hp', defs, 'source.NpcDefinition')),
  );
  const compiled = spawnSync(
    'mix',
    ['loka.compile', src, join(dir, 'out.json'), '--allow-placeholders'],
    {
      cwd: REPO,
      encoding: 'utf8',
    },
  );
  rmSync(join(src, 'npcs'), { recursive: true });
  assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
});

test("an action and a reaction built by their cards' adds compile", () => {
  // Breaks: an Action or Reaction card Add (or the check's paired failure) seeded at a value the
  // compiler refuses (OUTCOME_MISMATCH, a cooldown or delay below its minimum, an empty tip or
  // when, a craft with neither consume nor yield set), so every such add leaves a world that does
  // not compile. A craft has no least value: the author chooses its consume or yield.
  const defs = JSON.parse(
    readFileSync(join(REPO, 'schemas/source/defs.schema.json'), 'utf8'),
  ).$defs;
  const prose = { prose: '~' };
  const adds = (doc: object, fields: string[], def: string) =>
    fields.reduce((d, f) => added(d, f, defs, def)!, doc as Record<string, unknown>);
  assert.equal(added({}, 'craft', defs, 'source.ScriptedAction'), undefined);
  let action = adds(
    {
      ...{ name: prose, aliases: ['ponder'], target: { kind: 'use', tool: { tag: 'rod' } } },
      ...{
        priority: 1,
        outcomes: {
          success: { steps: [{ op: 'event.emit', event: 'bite' }], narration: { actor: prose } },
        },
      },
    },
    ['cooldown', 'duration', 'reason', 'tip', 'policy'],
    'source.ScriptedAction',
  );
  action = paired({ ...action, check: { key: 'ponder', kind: 'luck', chance: 50 } }, defs);
  const reaction = adds(
    { on: { event: 'clock_hour' }, steps: [] },
    ['after', 'silent', 'when'],
    'source.ReactionRule',
  );
  const kept = read('cartridge.json');
  const cartridge = JSON.parse(kept);
  Object.assign(cartridge.requires.capabilities, {
    scripted_action: 1,
    check: 1,
    fact: 1,
    reaction: 1,
    schedule: 1,
    policy: 1,
  });
  writeFileSync(join(src, 'cartridge.json'), JSON.stringify(cartridge));
  mkdirSync(join(src, 'actions'));
  mkdirSync(join(src, 'reactions'));
  writeFileSync(join(src, 'actions/ponder.json'), JSON.stringify(action));
  writeFileSync(join(src, 'reactions/chime.json'), JSON.stringify(reaction));
  const compiled = spawnSync(
    'mix',
    ['loka.compile', src, join(dir, 'out.json'), '--allow-placeholders'],
    { cwd: REPO, encoding: 'utf8' },
  );
  rmSync(join(src, 'actions'), { recursive: true });
  rmSync(join(src, 'reactions'), { recursive: true });
  writeFileSync(join(src, 'cartridge.json'), kept);
  assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
});

test('a template dropped on a room makes its child there; a refused drop writes nothing; undo removes it', async () => {
  // Breaks: --extends not passed (the child lacks the parent's hp), the child left unplaced, a
  // refused drop leaving a file, or /templates missing an area's or an item abstract, or listing a
  // concrete NPC or an abstract room, or reading through a link to an abstract file outside the tree.
  const tpl = 'areas/barn/npcs/goat.json';
  mkdirSync(join(src, 'areas/barn/npcs'), { recursive: true });
  const hp = { minimum: 0, maximum: 1, start: 1, gain: 0 };
  writeFileSync(join(src, tpl), JSON.stringify({ abstract: true, hp }));
  mkdirSync(join(src, 'items'));
  writeFileSync(join(src, 'items/sack.json'), '{ "abstract": true }');
  writeFileSync(join(src, 'areas/barn/npcs/cow.json'), '{ "abstract": false }');
  writeFileSync(join(src, 'rooms/mould.json'), '{ "abstract": true }');
  const ox = join(mkdtempSync(join(tmpdir(), 'outside-')), 'ox.json');
  writeFileSync(ox, '{ "abstract": true }');
  symlinkSync(ox, join(src, 'items/ox.json'));
  const listed = await ask('/templates');
  assert.deepEqual(
    [listed.ok, listed.told],
    [
      true,
      [
        { dir: 'npcs', key: 'goat' },
        { dir: 'items', key: 'sack' },
      ],
    ],
  );
  rmSync(join(src, 'items'), { recursive: true });
  for (const f of ['areas/barn/npcs/cow.json', 'rooms/mould.json']) rmSync(join(src, f));
  const was = files();
  // c is in the area yard; a root room may extend any area's template
  await assert.rejects(ed.made(c, 'npcs', 'goat_1', 'goat'), /belongs to the area barn/);
  assert.deepEqual(files(), was);
  await ed.made(start, 'npcs', 'goat_1', 'goat');
  const out = join(dir, 'out.json');
  const compiled = spawnSync('mix', ['loka.compile', src, out, '--allow-placeholders'], {
    cwd: REPO,
    encoding: 'utf8',
  });
  assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
  const npcs = JSON.parse(readFileSync(out, 'utf8')).cartridge.npcs;
  const child = Object.entries(npcs).find(([ref]) => ref.endsWith(':npc/goat_1'))?.[1] as any;
  assert.deepEqual([child?.hp, child?.room?.key], [hp, 'start']);
  await ed.undo();
  rmSync(join(src, 'areas/barn'), { recursive: true });
  assert.deepEqual(
    files(),
    was.filter((f) => f !== tpl),
  );
});

test('a barrier drop writes a locked barrier named on both faces, and refuses a one-way exit', async () => {
  // Breaks: one face left without the barrier (BARRIER_MISMATCH); `initial` not locked; a barrier
  // on a one-way exit.
  await ed.barrier(start, 'south', rooms(), 'hatch', true);
  assert.deepEqual(json('barriers/hatch.json'), {
    keywords: ['hatch'],
    name: { prose: '~' },
    initial: 'locked',
  });
  assert.deepEqual(json('rooms/start.json').exits.south, { to: 'cellar', barrier: 'hatch' });
  assert.deepEqual(json('rooms/cellar.json').exits.north, { to: 'start', barrier: 'hatch' });
  await assert.rejects(ed.barrier(c, 'south', rooms(), 'gate', false), /needs the exit both ways/);
  await assert.rejects(ed.barrier(start, 'south', rooms(), 'trap', false), /already has hatch/);
  assert.equal(existsSync(join(src, 'barriers/trap.json')), false);
});

test("a barrier between two rooms of one area is that area's; a refusal leaves no barrier file", async () => {
  // Breaks: a shared-area barrier put at the root, or a second barrier overwriting the first.
  await ed.grow(c, 'east', 'shed');
  const shed = room('shed', 'areas/yard/rooms/shed.json', 'yard');
  await ed.barrier(c, 'east', [...rooms(), shed], 'gate', false);
  assert.deepEqual(json('areas/yard/barriers/gate.json').initial, 'closed');
  assert.equal(existsSync(join(src, 'barriers/gate.json')), false);
});

test("a new NPC or item lands in the selected room's area, placed in that room", async () => {
  // Breaks: the area dropped (the file at the root), or the placement left as the scaffold's.
  await ed.made(c, 'npcs', 'hen');
  await ed.made(c, 'items', 'pail');
  const [hen, pail] = [json('areas/yard/npcs/hen.json'), json('areas/yard/items/pail.json')];
  assert.deepEqual([hen.room, hen.location], ['c', undefined]);
  assert.deepEqual([pail.location, pail.room], [{ in: 'room', room: 'c' }, undefined]);
  assert.equal(existsSync(join(src, 'npcs/hen.json')), false);
  assert.equal(existsSync(join(src, 'items/pail.json')), false);
});

test('two New item in a row, before a recompile, write item_1 then item_2', async () => {
  // Breaks: the second New reusing item_1 because the story still lacks it (the starter refuses it).
  await ed.made(start, 'items', freeKey('item', 'item', [], []));
  await ed.made(start, 'items', freeKey('item', 'item', [], []));
  for (const key of ['item_1', 'item_2'])
    assert.deepEqual(json(`items/${key}.json`).location, { in: 'room', room: 'start' });
});

test('a map point maps to its layout cell, and a drag between cells to a compass direction', () => {
  // Breaks: the cell size or pan offset wrong in the inverse of mapdraw.tsx; a diagonal or
  // cross-level drag read as an exit.
  assert.deepEqual(cellAt({ zoom: 1, x: 10, y: 20 }, { x: 74, y: 84 }), { x: 1, y: 1 });
  assert.deepEqual(cellAt({ zoom: 2, x: 0, y: 0 }, { x: 127, y: 128 }), { x: 0, y: 1 });
  const o = { x: 0, y: 0, z: 0 };
  const to = (x: number, y: number, z = 0) => toward(o, { x, y, z });
  assert.deepEqual(
    [
      to(1, 0),
      to(-1, 0),
      to(0, 1),
      to(0, -1),
      to(1, 1),
      to(-2, 1),
      to(1, -2),
      to(1, 0, 1),
      to(0, 0),
    ],
    ['east', 'west', 'south', 'north', 'east', 'west', 'north', undefined, undefined],
  );
});

test("a dropped template's child takes the first free <template>_<n>", () => {
  // Breaks: a child key reusing a compiled one (the starter refuses the drop), or starting past _1.
  // Also: an item's key counted against an NPC child, or a template's key (no node holds it) missed.
  const nodes = ['npc/wild', 'npc/wild_1', 'item/wild_2', 'npc/wild_4'].map((r) => ({
    kind: r.split('/')[0],
    ref: `cart@0:${r}`,
  }));
  const wild = (held: string[], on = nodes) => childKey('npcs', 'wild', on, held); // each call mints its key
  assert.deepEqual([wild([], []), wild([]), wild(['wild_3'])], ['wild_1', 'wild_2', 'wild_5']);
});

test('a press that stays within 4 px is a click (it selects); one that leaves is a drag', () => {
  // Breaks: a hand's slip read as a drag (a click writes layout.json), or a real drag read as a click.
  const o = { x: 10, y: 10 };
  assert.deepEqual(
    [
      dragged(o, o),
      dragged(o, { x: 13, y: 10 }),
      dragged(o, { x: 14, y: 10 }),
      dragged(o, { x: 13, y: 13 }),
    ],
    [false, false, true, true],
  );
});

test("a bind appends the short ref to that beat's nodes, and refuses a missing beat, a repeat or an unknown ref", async () => {
  // Breaks: a bind that replaces the beat's nodes, writes another beat, binds a ref twice, or
  // writes a ref the last compile does not have (the beat then reads missing, story.ts).
  const known = ['rooms/b', 'rooms/c'];
  await assert.rejects(ed.bind(0, 1, 'nosuch/thing', known), /nosuch\/thing is no definition/);
  await ed.bind(0, 1, 'rooms/c', known);
  await ed.bind(0, 2, 'rooms/c', known);
  assert.deepEqual(
    json('outline.json').parts[0].beats.map((x: { nodes?: string[] }) => x.nodes),
    [['rooms/c'], ['rooms/b', 'rooms/c']],
  );
  await assert.rejects(ed.bind(0, 3, 'rooms/c', known), /part 1 has no beat 3/);
  await assert.rejects(ed.bind(0, 2, 'rooms/b', known), /beat 2 already binds rooms\/b/);
});

test('a beat is added in number order, retitled and removed; a repeated or a below-1 number is refused', async () => {
  // Breaks: an add that writes a repeated n (readOutline then refuses the whole outline) or a number
  // below 1, appends out of number order, a retitle or remove that lands on another beat, an empty
  // title written instead of removed, or an empty title on an untitled beat sent as a delete.
  await assert.rejects(ed.addBeat(0, 2), /outline.json already has beat 2/);
  await assert.rejects(ed.addBeat(0, 0), /a whole number from 1, not 0/);
  await ed.addBeat(0, 5);
  await ed.addBeat(0, 4);
  let posts = 0;
  await editor({ ...io, post: (route, sent) => (posts++, io.post(route, sent)) }).titleBeat(
    0,
    4,
    '',
  );
  assert.equal(posts, 0);
  await ed.titleBeat(0, 5, 'The well');
  await ed.dropBeat(0, 1);
  const beats = () =>
    json('outline.json').parts[0].beats.map((b: { n: number; title?: string }) => [b.n, b.title]);
  assert.deepEqual(beats(), [
    [2, undefined],
    [4, undefined],
    [5, 'The well'],
  ]);
  await ed.titleBeat(0, 5, '');
  assert.deepEqual(beats(), [
    [2, undefined],
    [4, undefined],
    [5, undefined],
  ]);
  await assert.rejects(ed.dropBeat(0, 1), /part 1 has no beat 1/);
  await ed.addBeat(0, 1); // 1 is the least number, and goes first
  assert.deepEqual(beats()[0], [1, undefined]);
});

test('a refused put-back is told with the refusal that stopped the gesture', async () => {
  // Breaks: the put-back's refusal hiding why the gesture stopped, or a refusal sent as text
  // reported as a stale file.
  const io: Io = {
    post: async (route) =>
      route === 'undo' ? { ok: false, told: 'held' } : { ok: true, told: { id: 1 } },
    source: async (file) => ({
      bytes: file === 'y.json' ? '{"exits":{"west":{"to":"z"}}}' : '{}',
      sha256: '',
    }),
  };
  const [x, y] = [room('x', 'x.json'), room('y', 'y.json')];
  await assert.rejects(
    editor(io).link(x, 'east', y),
    /y already has an exit west; put back stopped: held$/,
  );
});

test('a drop on an empty map writes the first row at 0,0,0 and the knowledge it needs', async () => {
  // Breaks: an empty map refusing the drop; a row without knowledge@1 (lib/loka/content/layout.ex:62).
  const old = (rel = '') => join(dir, 'old', rel);
  const read = (rel: string) => JSON.parse(readFileSync(old(rel), 'utf8'));
  execFileSync('mix', ['loka.new', 'cartridge', old()], { cwd: REPO, stdio: 'ignore' });
  rmSync(old('layout.json')); // a world made before the starter placed its room
  const cartridge = read('cartridge.json');
  delete cartridge.requires.capabilities.knowledge;
  writeFileSync(old('cartridge.json'), JSON.stringify(cartridge));
  const s = await open(old());
  await editor(s.io).first().finally(s.close);
  const got = [read('layout.json'), read('cartridge.json').requires.capabilities.knowledge];
  assert.deepEqual(got, [[{ room: 'start', x: 0, y: 0, z: 0 }], 1]);
});

test('a key a file or an area bundle already holds is refused, compiled or not', async () => {
  // Breaks: New room from here joining a room the last compile lacks (exits written into both);
  // New NPC here writing a second npc_9 file in another area, or an item a bundle already holds.
  const planted = {
    'rooms/room_9.json': read('rooms/start.json'),
    'npcs/npc_9.json': '{}\n',
    'areas/zz.json': '{ "items": { "item_9": {} }, "scenes": { "cut_9": {} } }\n',
  };
  for (const [f, bytes] of Object.entries(planted)) writeFileSync(join(src, f), bytes);
  try {
    const was = read('rooms/b.json');
    await assert.rejects(
      ed.grow(b, 'south', 'room_9'),
      /rooms\/room_9 exists in rooms\/room_9.json/,
    );
    assert.deepEqual(
      [read('rooms/b.json'), read('rooms/room_9.json')],
      [was, planted['rooms/room_9.json']],
    );
    await assert.rejects(ed.made(c, 'npcs', 'npc_9'), /npcs\/npc_9 exists in npcs\/npc_9.json/);
    assert.equal(existsSync(join(src, 'areas/yard/npcs/npc_9.json')), false);
    await assert.rejects(
      ed.made(start, 'items', 'item_9'),
      /items\/item_9 exists in areas\/zz.json/,
    );
    assert.equal(existsSync(join(src, 'items/item_9.json')), false);
    // Breaks: a New area (its first room) not checked as a room; a key of another kind counted.
    assert.deepEqual(await io.post('new', { kind: 'areas', name: 'room_9' }), {
      ok: false,
      told: 'rooms/room_9 exists in rooms/room_9.json',
    });
    // Breaks: a cutscene checked under cutscene/ (not scenes/); a New area joining an area folder.
    assert.deepEqual(await io.post('new', { kind: 'cutscene', name: 'cut_9' }), {
      ok: false,
      told: 'scenes/cut_9 exists in areas/zz.json',
    });
    assert.match((await io.post('new', { kind: 'areas', name: 'yard' })).told, /in areas\/yard\//);
    await ed.made(start, 'items', 'npc_9');
  } finally {
    for (const f of Object.keys(planted)) rmSync(join(src, f));
  }
});

test('undo puts every gesture back: the files are byte-identical to the start', async () => {
  // Breaks: an undo that skips a gesture's earlier writes, or a refused gesture left on the stack.
  while (ed.undoable()) await ed.undo();
  assert.deepEqual(Object.fromEntries(files().map((f) => [f, read(f)])), snapshot);
  await assert.rejects(ed.undo(), /no map edit to undo/);
});
