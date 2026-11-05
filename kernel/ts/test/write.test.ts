// The editor's write path (docs/system/cartridge.md#author-preview): the one path guard, the Host
// and Origin checks, the whole-file `was`, the journal and undo, on controlled source trees.
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { existsSync, symlinkSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { serve } from '../play/live.ts';
import { sha256 } from '../play/guard.ts';

const ROOM = '{\n  "name": "room.a",\n  "exits": {}\n}\n';
type Reply = { status: number; body: any };

/** A source tree `src/` (rooms/a.json, layout.json) beside a sibling `src-evil/`, served. */
function tree(t: { after: (f: () => void) => void }, release = () => {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loka-write-')));
  const src = join(dir, 'src');
  mkdirSync(join(src, 'rooms'), { recursive: true });
  mkdirSync(join(dir, 'src-evil/rooms'), { recursive: true });
  writeFileSync(join(src, 'rooms/a.json'), ROOM);
  writeFileSync(join(dir, 'src-evil/rooms/x.json'), 'secret');
  writeFileSync(join(src, 'layout.json'), '[\n  { "room": "a", "x": 0, "y": 0, "z": 0 }\n]\n');
  const port = 20000 + Math.floor(Math.random() * 20000);
  const live = serve(port, src, join(dir, 'none.json'), release);
  t.after(() => {
    live.close();
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
      req.end(sent === undefined ? undefined : JSON.stringify(sent));
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
  assert.equal((await ask('/source?file=rooms/a.json')).body.bytes, ROOM);
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
    journal.map((e: any) => [e.by, e.files]),
    [
      ['outside', ['rooms/c.json']],
      ['editor', ['rooms/a.json']],
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

test('/new refuses a name that is a flag before it runs anything, and journals what loka.new wrote', async (t) => {
  // Breaks: `--cwd` as a name reaching mix (it would scaffold into another tree); the files the
  // scaffold wrote missing from the entry undo reads.
  const { dir, ask } = tree(t);
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  // the stub `mise exec -- mix loka.new <kind> <name> <root>`: a mark that it ran, and one room
  writeFileSync(
    join(bin, 'mise'),
    '#!/bin/sh\ntouch "$0.ran"\nsleep 0.5\necho "{}" > "$7/rooms/$6.json"\n',
  );
  chmodSync(join(bin, 'mise'), 0o755);
  const path = process.env.PATH;
  process.env.PATH = `${bin}:${path}`;
  t.after(() => (process.env.PATH = path));
  assert.equal((await ask('/new', { kind: 'room', name: '--cwd' })).status, 400);
  assert.equal(existsSync(join(bin, 'mise.ran')), false);
  const making = ask('/new', { kind: 'room', name: 'cellar' });
  // Break: a write during the run lands in the new entry's snapshot diff, so its undo reverts it.
  await new Promise((r) => setTimeout(r, 200));
  const during = { file: 'rooms/a.json', was: sha256(ROOM), ops: [] };
  assert.equal((await ask('/change', during)).status, 409);
  const made = await making;
  assert.deepEqual([made.status, made.body.files], [200, ['rooms/cellar.json']]);
  assert.equal((await ask('/undo', { id: made.body.id })).status, 200);
});

test('POST /hold sets held on the stream and its release writes what was parked', async (t) => {
  // Break: a Hold the page turns off that never writes the parked compile (the Book stays stale).
  let released = 0;
  const { ask, live } = tree(t, () => released++);
  assert.equal((await ask('/hold', { on: 'yes' })).status, 400);
  assert.deepEqual((await ask('/hold', { on: true })).body, { held: true });
  assert.deepEqual([live.held(), released], [true, 0]);
  await ask('/hold', { on: false });
  assert.deepEqual([live.held(), released], [false, 1]);
});

test('the journal drops its oldest entries past its byte cap', async (t) => {
  // Break: a journal that keeps every before and after grows without bound in a long session.
  const { ask, src } = tree(t);
  const big = `"${'x'.repeat(25 * 1024 * 1024)}"\n`;
  writeFileSync(join(src, 'rooms/big.json'), big);
  const first = await ask('/change', { file: 'rooms/big.json', was: sha256(big), ops: [] });
  const second = await ask('/delete', { file: 'rooms/big.json', was: sha256(big) });
  assert.equal(second.status, 200);
  assert.deepEqual(
    (await ask('/journal')).body.map((e: any) => e.id),
    [second.body.id],
  );
  assert.equal((await ask('/undo', { id: first.body.id })).status, 404);
});
