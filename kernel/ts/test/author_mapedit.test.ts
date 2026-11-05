// The editor map's edits (tools/author-panel/src/mapedit.ts) through the real write routes
// (play/write.ts) and the real `mix loka.new`, on one scaffolded cartridge the tests edit in turn;
// the last one undoes every gesture. Expected files are written by hand.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { realpathSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { after, before, test } from 'node:test';
import { serve } from '../play/live.ts';
import type { MapRoom } from '../../../tools/author-panel/src/map.ts';
import {
  cellAt,
  editor,
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
let snapshot: Record<string, string>;

before(async () => {
  // CI has mix but no mise: the stub runs the command (as ci.yml's kernel job does)
  mkdirSync(join(dir, 'bin'));
  writeFileSync(join(dir, 'bin/mise'), '#!/bin/sh\nshift 2\nexec "$@"\n');
  chmodSync(join(dir, 'bin/mise'), 0o755);
  process.env.PATH = `${join(dir, 'bin')}:${process.env.PATH}`;
  execFileSync('mix', ['loka.new', 'cartridge', src], { cwd: REPO, stdio: 'ignore' });
  const cartridge = json('cartridge.json');
  cartridge.requires.capabilities.knowledge = 1; // a layout needs it (Loka.Content.Layout)
  writeFileSync(join(src, 'cartridge.json'), JSON.stringify(cartridge));
  const blank = read('rooms/start.json');
  writeFileSync(join(src, 'rooms/b.json'), blank);
  writeFileSync(join(src, 'rooms/c.json'), blank);
  writeFileSync(join(src, 'layout.json'), '[\n  { "room": "start", "x": 0, "y": 0, "z": 0 }\n]\n');
  snapshot = Object.fromEntries(files().map((f) => [f, read(f)]));
  const live = serve(0, src, join(dir, 'none.json'));
  const port = await live.port;
  close = () => live.close();
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
  await assert.rejects(ed.grow(start, 'south', 'cellar2'), /start already has an exit south/);
  // Breaks: the server's own refusal text replaced by the stale-file message
  await assert.rejects(ed.grow(start, 'west', 'Cellar'), /kind, name, area/);
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

test('undo puts every gesture back: the files are byte-identical to the start', async () => {
  // Breaks: an undo that skips a gesture's earlier writes, or a refused gesture left on the stack.
  while (ed.undoable()) await ed.undo();
  assert.deepEqual(Object.fromEntries(files().map((f) => [f, read(f)])), snapshot);
  await assert.rejects(ed.undo(), /no map edit to undo/);
});
