// The editor's write path (docs/system/cartridge.md#author-preview): the one path guard, the Host
// and Origin checks, the whole-file `was`, the journal and undo, on controlled source trees.
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { existsSync, symlinkSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { serve } from '../play/live.ts';
import { guarded, placed, sha256, type Refused } from '../play/guard.ts';

const ROOM = '{\n  "name": "room.a",\n  "exits": {}\n}\n';
type Reply = { status: number; body: any };

/** A source tree `src/` (rooms/a.json, layout.json) beside a sibling `src-evil/`, served. */
function tree(t: TestContext, release = () => {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loka-write-')));
  const src = join(dir, 'src');
  mkdirSync(join(src, 'rooms'), { recursive: true });
  mkdirSync(join(dir, 'src-evil/rooms'), { recursive: true });
  writeFileSync(join(src, 'rooms/a.json'), ROOM);
  writeFileSync(join(dir, 'src-evil/rooms/x.json'), 'secret');
  writeFileSync(join(src, 'layout.json'), '[\n  { "room": "a", "x": 0, "y": 0, "z": 0 }\n]\n');
  const port = 20000 + Math.floor(Math.random() * 20000);
  const live = serve(port, src, join(dir, 'none.json'), release);
  const errors = t.mock.method(console, 'error', () => {});
  t.after(() => {
    live.close();
    assert.deepEqual(errors.mock.calls, []); // no route ran on after its answer
    rmSync(dir, { recursive: true, force: true });
  });
  const ask = (path: string, sent?: unknown, headers: Record<string, string> = {}) =>
    new Promise<Reply>((done, fail) => {
      const method = sent === undefined ? 'GET' : 'POST';
      const req = request({
        port,
        path,
        method,
        headers: { host: `localhost:${port}`, ...headers },
      });
      req.on('error', fail).on('response', async (res) => {
        let text = '';
        for await (const chunk of res) text += chunk;
        done({
          status: res.statusCode!,
          body: res.headers['content-type'] ? JSON.parse(text) : text,
        });
      });
      req.end(typeof sent === 'string' ? sent : JSON.stringify(sent)); // a string goes raw
    });
  const read = (rel: string) => readFileSync(join(src, rel), 'utf8');
  return { dir, src, ask, read, live };
}

test('a path outside the source tree is refused before any file is read', async (t) => {
  // Breaks: a `..` in the path, a prefix sibling (`src-evil` starts with `src`: a check of
  // `startsWith(root)` without the separator passes it), or a path that is not normal.
  const { ask } = tree(t);
  for (const file of [
    '../src-evil/rooms/x.json',
    'rooms/../../src-evil/rooms/x.json',
    '/etc/hosts',
  ]) {
    const got = await ask(`/source?file=${encodeURIComponent(file)}`);
    assert.equal(got.status, 400, file);
    assert.doesNotMatch(JSON.stringify(got.body), /secret/);
  }
  const sibling = await ask('/source?file=../src-evil/rooms/x.json');
  assert.match(sibling.body, /^outside the source tree/);
  const own = await ask('/source?file=rooms/a.json');
  assert.deepEqual(
    [own.status, own.body.bytes, own.body.kind, own.body.key],
    [200, ROOM, 'rooms', 'a'],
  );
});

test('GET /schema/<kind> is the source schema with its defs inlined; another name is a 404', async (t) => {
  // Break: the panel's form validating against a schema whose $ref points at a file it cannot load.
  const { ask } = tree(t);
  const rooms = await ask('/schema/rooms');
  assert.deepEqual(
    [rooms.status, rooms.body.$ref.startsWith('#'), typeof rooms.body.$defs],
    [200, true, 'object'],
  );
  assert.equal((await ask('/schema/defs')).status, 404);
  assert.equal((await ask('/schema/../defs')).status, 404);
});

test('a symlink on the way, or as the file, is refused for reads and writes', async (t) => {
  // Breaks: a guard that only checks the joined string follows `areas -> outside` on a move and
  // writes outside the tree, or reads a linked file's bytes.
  const { dir, src, ask } = tree(t);
  mkdirSync(join(dir, 'outside'));
  symlinkSync(join(dir, 'outside'), join(src, 'areas'));
  symlinkSync(join(dir, 'src-evil/rooms/x.json'), join(src, 'rooms/b.json'));
  const was = sha256(ROOM);
  const moved = await ask('/move', { file: 'rooms/a.json', was, area: 'evil' });
  assert.deepEqual(
    [moved.status, moved.body],
    [400, 'a symlink on the way to areas/evil/rooms/a.json'],
  );
  assert.equal(existsSync(join(dir, 'outside/evil')), false);
  const linked = await ask('/source?file=rooms/b.json');
  assert.deepEqual([linked.status, linked.body], [400, 'not a regular file: rooms/b.json']);
});

test('only the author page may ask: a foreign Host on any route, a foreign Origin on a POST', async (t) => {
  // Breaks: a DNS-rebinding page (its own name as Host) reads the tree or the stream; a
  // cross-site page's simple POST writes it.
  const { ask, read } = tree(t);
  for (const path of ['/source?file=rooms/a.json', '/events', '/todo'])
    assert.equal((await ask(path, undefined, { host: 'evil.example:80' })).status, 403, path);
  const sent = { file: 'rooms/a.json', was: sha256(ROOM), ops: [{ path: ['name'], value: 'x' }] };
  assert.equal((await ask('/change', sent, { origin: 'https://evil.example' })).status, 403);
  assert.equal(read('rooms/a.json'), ROOM);
  assert.equal((await ask('/change', sent, { origin: 'http://localhost:8081' })).status, 200);
});

test('a stale whole-file was is a 409 with the current bytes, and nothing is written', async (t) => {
  // Break: a change applied over an outside edit the panel never saw, losing it.
  const { ask, read, src } = tree(t);
  const was = sha256(ROOM);
  writeFileSync(join(src, 'rooms/a.json'), ROOM.replace('{}', '{ "north": "b" }'));
  const now = read('rooms/a.json');
  const got = await ask('/change', {
    file: 'rooms/a.json',
    was,
    ops: [{ path: ['name'], value: 'x' }],
  });
  assert.deepEqual(got, { status: 409, body: { bytes: now, sha256: sha256(now) } });
  assert.equal(read('rooms/a.json'), now);
});

test('ops write the house format and keep integer-like keys; a path into a prototype is refused', async (t) => {
  // Breaks: `__proto__` as a step sets the parsed object's prototype; a path through a string
  // throws a 500; a daily_schedule written in another order than Node's (ascending) would churn.
  const { ask, read } = tree(t);
  let was = sha256(ROOM);
  const set = (ops: unknown[]) => ask('/change', { file: 'rooms/a.json', was, ops });
  assert.equal((await set([{ path: ['__proto__', 'x'], value: 1 }])).status, 400);
  assert.equal((await set([{ path: ['name', 'x'], value: 1 }])).status, 400);
  // Breaks: a path that is no array, or one that walks on past a string, throws a 500.
  assert.equal((await set([{ path: 'x', value: 1 }])).status, 400);
  assert.equal((await set([{ path: ['name', 'x', 'y'], value: 1 }])).status, 400);
  // Break: index 0, or the last element, refused, or a delete taking two elements.
  const ends = await set([
    { path: ['exits'], value: ['n', 's', 'w'] },
    { path: ['exits', 0], value: 'e' },
    { path: ['exits', 2], delete: true },
    { path: ['exits', 0], delete: true },
  ]);
  assert.equal(ends.status, 200);
  assert.deepEqual(JSON.parse(read('rooms/a.json')).exits, ['s']);
  was = ends.body.sha256;
  // Break: an array step that is no index (NaN splices 0, -1 the last) deletes another element.
  for (const step of ['north', -1, 1])
    assert.equal(
      (
        await set([
          { path: ['exits'], value: ['n'] },
          { path: ['exits', step], delete: true },
        ])
      ).status,
      400,
    );
  const ok = await set([
    { path: ['daily_schedule'], value: { '14': 'b', '8': 'a' } },
    { path: ['exits'], value: ['n'] },
    { path: ['exits', 1], value: 's' }, // one past the end appends
    { path: ['exits'], delete: true },
  ]);
  assert.equal(ok.status, 200);
  const bytes =
    '{\n  "name": "room.a",\n  "daily_schedule": {\n    "8": "a",\n    "14": "b"\n  }\n}\n';
  assert.equal(read('rooms/a.json'), bytes);
  assert.equal(ok.body.sha256, sha256(bytes));
});

test('a delete touches layout.json only when it holds the room', async (t) => {
  // Breaks: a room without a layout row rewriting layout.json (journaled as touched), or a room
  // deleted with no layout.json reading the missing file (a 500).
  const { ask, src } = tree(t);
  const files = async () =>
    (await ask('/journal')).body.find((e: { by: string }) => e.by === 'editor').files;
  for (const [name, gone] of [
    ['b', ['rooms/b.json']],
    ['a', ['rooms/a.json', 'layout.json']],
    ['c', ['rooms/c.json']],
  ]) {
    writeFileSync(join(src, `rooms/${name}.json`), ROOM);
    const sent = { file: `rooms/${name}.json`, was: sha256(ROOM) };
    assert.equal((await ask('/delete', sent)).status, 200);
    assert.deepEqual(await files(), gone);
  }
});

test('undo puts the files back, refuses one changed since, and knows no other id', async (t) => {
  // Breaks: undo over a newer edit (losing it), or a delete's layout row not coming back; the
  // last row's delete leaving `[]`, which the layout schema refuses (minItems 1).
  // The 409 carries sha256 as /change's does, so the panel rebases the same way.
  const { ask, read, src } = tree(t);
  const layout = read('layout.json');
  const gone = await ask('/delete', { file: 'rooms/a.json', was: sha256(ROOM) });
  assert.equal(gone.status, 200);
  assert.equal(existsSync(join(src, 'rooms/a.json')), false);
  assert.equal(existsSync(join(src, 'layout.json')), false);
  writeFileSync(join(src, 'layout.json'), '[1]\n');
  const late = await ask('/undo', { id: gone.body.id });
  const body = { file: 'layout.json', bytes: '[1]\n', sha256: sha256('[1]\n') };
  assert.deepEqual([late.status, late.body], [409, body]);
  assert.equal(existsSync(join(src, 'rooms/a.json')), false); // checked all before writing any
  rmSync(join(src, 'layout.json'));
  assert.equal((await ask('/undo', { id: gone.body.id })).status, 200);
  assert.deepEqual([read('rooms/a.json'), read('layout.json')], [ROOM, layout]);
  assert.equal((await ask('/undo', { id: 99 })).status, 404);
});

test('an outside change is journaled once as outside; an editor write is not journaled again', async (t) => {
  // Breaks: the burst after an editor write records it a second time as `outside`, or an
  // outside save never reaches the journal undo reads.
  const { ask, src, live } = tree(t);
  await ask('/change', {
    file: 'rooms/a.json',
    was: sha256(ROOM),
    ops: [{ path: ['name'], value: 'x' }],
  });
  live.seen();
  writeFileSync(join(src, 'rooms/c.json'), '{}\n');
  live.seen();
  live.seen();
  const journal = (await ask('/journal')).body;
  assert.deepEqual(
    journal.map((e: any) => [e.id, e.by, e.files]),
    [
      [2, 'outside', ['rooms/c.json']],
      [1, 'editor', ['rooms/a.json']],
    ],
  );
});

test('/edit replaces only the words of one line, and refuses a line that is not words', async (t) => {
  // Breaks: a quote in the words ends the JSON string; a key or choice line rewritten; an edit
  // over a line that changed since.
  const { ask, read, src } = tree(t);
  writeFileSync(join(src, 'text.json'), '{\n  "room.a": "old words",\n  "room.b": "b"\n}\n');
  const edit = (sent: object) =>
    ask('/edit', { file: 'text.json', line: 2, was: '  "room.a": "old words",', ...sent });
  assert.equal((await edit({ words: 'two\nlines' })).status, 400);
  assert.equal((await edit({ was: '  "room.a": "older",', words: 'x' })).status, 409);
  assert.equal((await edit({ words: 'she said "go"' })).status, 200);
  assert.equal(read('text.json'), '{\n  "room.a": "she said \\"go\\"",\n  "room.b": "b"\n}\n');
  mkdirSync(join(src, 'scenes'));
  writeFileSync(join(src, 'scenes/s.scene'), 'npc: stranger\n* hello\n- Go on\n');
  const scene = (line: number, was: string) =>
    ask('/edit', { file: 'scenes/s.scene', line, was, words: 'new' });
  assert.deepEqual((await scene(1, 'npc: stranger')).body, 'a key line');
  assert.deepEqual((await scene(3, '- Go on')).body, 'a choice label: its key is its words');
  assert.equal((await scene(2, '* hello')).status, 200);
  assert.equal(read('scenes/s.scene'), 'npc: stranger\n* new\n- Go on\n');
});

test('each refusal is a 400 that names its reason', async (t) => {
  // Break: a refusal answered with another status, a bound or type check that lets a bad request
  // through to a 409 or a write, or a refusal that names another reason.
  const { ask, src } = tree(t);
  mkdirSync(join(src, 'scenes'));
  writeFileSync(join(src, 'scenes/s.scene'), '* hello\n');
  writeFileSync(join(src, 'rooms/bad.json'), '{');
  const TEXT = '{\n  "room.a": "old words"\n}\n';
  writeFileSync(join(src, 'text.json'), TEXT);
  const room = { file: 'rooms/a.json', was: sha256(ROOM) };
  const edit = (line: unknown, was: unknown) => ({ file: 'text.json', line, was, words: 'x' });
  const cases: [string, object, string][] = [
    [
      '/change',
      { file: 'scenes/s.scene', was: '', ops: [] },
      'a scene file changes by /edit, a line at a time',
    ],
    [
      '/change',
      { file: 'rooms/bad.json', was: sha256('{'), ops: [] },
      'rooms/bad.json is not JSON: fix it first',
    ],
    ['/change', { ...room, ops: {} }, 'ops: an array'],
    ['/change', { ...room, ops: [{ path: ['name'] }] }, 'an op sets a value or deletes'],
    [
      '/delete',
      { file: 'text.json', was: sha256(TEXT) },
      'text.json is a root file: delete its rows, not the file',
    ],
    [
      '/move',
      { file: 'text.json', was: sha256(TEXT), area: null },
      'text.json is not a definition file',
    ],
    ['/move', { ...room, area: 'North' }, 'area: [a-z0-9_]+, or null for the root'],
    ['/edit', edit(4, ''), 'not a line of words'], // the empty line after the last newline
    ['/edit', edit(2, 5), 'was and words: one line each, no tab'],
    ['/edit', edit(0, '{'), 'no such line'],
    ['/edit', edit(1.5, '{'), 'no such line'],
    ['/edit', edit(5, ''), 'no such line'],
    [
      '/new',
      { kind: 'room', name: 'b', area: 'north' },
      'a new file in an area waits for area starters (S3)',
    ],
  ];
  const got = [];
  for (const [url, sent] of cases) got.push(await ask(url, sent));
  assert.deepEqual(
    got,
    cases.map(([, , body]) => ({ status: 400, body })),
  );
  assert.equal((await ask('/journal')).status, 200);
});

test('/new refuses a name that is a flag before it runs anything, and journals what loka.new wrote', async (t) => {
  // Breaks: `--cwd` as a name reaching mix (it would scaffold into another tree); the files the
  // scaffold wrote missing from the entry undo reads.
  const { dir, ask, live } = tree(t);
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  // the stub `mise exec -- mix loka.new <kind> <name> <root>`: a mark that it ran, and one room
  writeFileSync(
    join(bin, 'mise'),
    '#!/bin/sh\ntouch "$0.ran"\n[ "$6" = taken ] && { echo "noise\nrooms/taken.json exists" >&2; exit 1; }\nsleep 0.5\necho "{}" > "$7/rooms/$6.json"\nsleep 0.5\n',
  );
  chmodSync(join(bin, 'mise'), 0o755);
  const path = process.env.PATH;
  process.env.PATH = `${bin}:${path}`;
  t.after(() => (process.env.PATH = path));
  assert.equal((await ask('/new', { kind: 'room', name: '--cwd' })).status, 400);
  const from = { room: 'a', direction: 'North' };
  assert.equal((await ask('/new', { kind: 'room', name: 'b', from })).status, 400);
  assert.equal(existsSync(join(bin, 'mise.ran')), false);
  // Break: loka.new's refusal answered as another status, or by other words than its last line.
  const taken = { status: 400, body: 'rooms/taken.json exists' };
  assert.deepEqual(await ask('/new', { kind: 'room', name: 'taken' }), taken);
  const making = ask('/new', { kind: 'room', name: 'cellar' });
  // Break: a write during the run lands in the new entry's snapshot diff, so its undo reverts it.
  await new Promise((r) => setTimeout(r, 200));
  const during = { file: 'rooms/a.json', was: sha256(ROOM), ops: [] };
  assert.equal((await ask('/change', during)).status, 409);
  // Break: a burst while loka.new runs journals its writes a second time, as outside.
  await new Promise((r) => setTimeout(r, 500));
  live.seen();
  const made = await making;
  assert.deepEqual([made.status, made.body.files], [200, ['rooms/cellar.json']]);
  assert.deepEqual(
    (await ask('/journal')).body.map((e: any) => e.by),
    ['editor'],
  );
  assert.equal((await ask('/undo', { id: made.body.id })).status, 200);
});

test('POST /hold sets held on the stream and its release writes what was parked', async (t) => {
  // Break: a Hold the page turns off that never writes the parked compile (the Book stays stale).
  let released = 0;
  const { ask, live } = tree(t, () => released++);
  assert.equal((await ask('/hold', { on: 'yes' })).status, 400);
  assert.deepEqual(await ask('/hold', '{on'), { status: 400, body: 'a JSON body' });
  assert.deepEqual(await ask('/hold', { on: true }), { status: 200, body: { held: true } });
  assert.deepEqual([live.held(), released], [true, 0]);
  await ask('/hold', { on: false });
  assert.deepEqual([live.held(), released], [false, 1]);
});

test('the journal drops its oldest entries past its byte cap', async (t) => {
  // Break: a journal that keeps every before and after grows without bound in a long session.
  // Breaks: a cap other than 64 MiB of characters, an entry dropped at exactly the cap, a lone
  // entry over the cap dropped (its undo lost).
  const { ask, src } = tree(t);
  const MiB = 1024 * 1024;
  const big = (n: number) => `"${'x'.repeat(n - 3)}"\n`; // n characters, in the house format
  writeFileSync(join(src, 'rooms/b.json'), big(16 * MiB));
  writeFileSync(join(src, 'rooms/c.json'), big(32 * MiB));
  const first = await ask('/change', { file: 'rooms/b.json', was: sha256(big(16 * MiB)), ops: [] });
  const second = await ask('/delete', { file: 'rooms/c.json', was: sha256(big(32 * MiB)) });
  const ids = async () => (await ask('/journal')).body.map((e: any) => e.id);
  assert.deepEqual(await ids(), [second.body.id, first.body.id]); // 16 + 16 + 32: at the cap
  const third = await ask('/change', { file: 'rooms/a.json', was: sha256(ROOM), ops: [] });
  assert.deepEqual(await ids(), [third.body.id, second.body.id]);
  assert.equal((await ask('/undo', { id: first.body.id })).status, 404);
  const lone = tree(t);
  writeFileSync(join(lone.src, 'rooms/d.json'), big(33 * MiB));
  await lone.ask('/change', { file: 'rooms/d.json', was: sha256(big(33 * MiB)), ops: [] });
  assert.equal((await lone.ask('/journal')).body.length, 1);
});

test('a new file may take only a place Source.classify reads; a taken or unlisted one is refused', async (t) => {
  // Breaks: /move or /new writing a file the compile never reads (a `.cut` beside a dialogue, a
  // folder that is no area, a dir with no schema), or the wrong status for a taken or absent file.
  const { src } = tree(t);
  const at = (dir: string, key: string, ext: string, area: string | null = null) => ({
    dir,
    key,
    ext,
    area,
  });
  assert.deepEqual(placed('rooms/a.json'), at('rooms', 'a', 'json'));
  assert.deepEqual(placed('areas/north/rooms/a.json'), at('rooms', 'a', 'json', 'north'));
  assert.deepEqual(placed('dialogues/b.scene'), at('dialogues', 'b', 'scene'));
  assert.deepEqual(placed('scenes/c.cut'), at('scenes', 'c', 'cut'));
  for (const rel of [
    'areas/North/rooms/a.json',
    'lands/north/rooms/a.json',
    'rooms/x/a.json',
    'rooms/a.scene',
    'dialogues/a.cut',
    'rooms/a.txt',
    'bogus/a.json',
    'rooms',
  ])
    assert.equal(placed(rel), undefined, rel);
  const status = (rel: string, mode: 'read' | 'create') => {
    try {
      guarded(src, rel, mode);
      return 200;
    } catch (e) {
      return (e as Refused).status;
    }
  };
  assert.deepEqual(
    ['facts.json', 'areas/north.json', 'scenes/c.cut', 'notes.json', 'areas/x/y.json'].map((r) =>
      status(r, 'create'),
    ),
    [200, 200, 200, 400, 400],
  );
  assert.deepEqual(
    [status('rooms/a.json', 'create'), status('rooms/z.json', 'read'), status('rooms', 'read')],
    [409, 404, 404],
  );
});
