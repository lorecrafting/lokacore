// Fast loop: only a change confined to text values travels as an overlay; anything structural
// does not (docs/system/cartridge.md#author-preview).
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { lastRun, serve, sourceOf, textOnly } from '../play/live.ts';

const was = { format: 1, rooms: { a: { name: 'room.a' } }, text: { 'room.a': 'line one' } };

test('changed and new text values form the overlay; a removed key is not in it', () => {
  // Break: sending every text value (the page would re-resolve nothing it lacks, but a 2 MB
  // overlay per keystroke), or dropping the new key.
  const next = { ...was, text: { 'room.a': 'line two', 'room.b': 'line three' } };
  assert.deepEqual(textOnly(was, next), { 'room.a': 'line two', 'room.b': 'line three' });
  assert.deepEqual(textOnly(was, { ...was, text: {} }), {});
  assert.deepEqual(textOnly(was, was), {});
});

test('a change outside text is not text-only, even with the same text', () => {
  // Break: comparing only key sets, or only the text, so a room edit never reaches the artifact.
  assert.equal(textOnly(was, { ...was, rooms: { a: { name: 'room.b' } } }), undefined);
  assert.equal(textOnly(was, { ...was, format: 2 }), undefined);
});

// Checkpoints are the one file the page writes. Breaks: a name that is a path writes outside
// `checkpoints/`; a body without a steps array is saved and breaks the next replay.
test('checkpoints: a name is a file under checkpoints/, the body a steps array', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-live-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const server = serve(port, dir, join(dir, 'none.json'));
  t.after(() => server.close());
  const at = (path: string, init?: RequestInit) => fetch(`http://127.0.0.1:${port}${path}`, init);
  const steps = [{ advance: 1 }];
  assert.equal(
    (await at('/checkpoints/cellar-1', { method: 'PUT', body: '{"steps":"x"}' })).status,
    400,
  );
  assert.equal(
    (await at('/checkpoints/cellar-1', { method: 'PUT', body: JSON.stringify({ steps }) })).status,
    204,
  );
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'checkpoints/cellar-1.json'), 'utf8')), {
    steps,
  });
  const listed = await at('/checkpoints');
  assert.equal(listed.status, 200);
  assert.deepEqual(await listed.json(), ['cellar-1']);
  const read = await at('/checkpoints/cellar-1');
  assert.equal(read.status, 200);
  assert.deepEqual(await read.json(), { steps });
  assert.equal((await at('/checkpoints/other')).status, 404);
  assert.equal((await at('/checkpoints/cellar-1', { method: 'DELETE' })).status, 405);
  const ac = new AbortController(); // the stream stays open; the status is the check
  assert.equal((await at('/events', { signal: ac.signal })).status, 200);
  ac.abort();
  for (const bad of ['/checkpoints/../x', '/checkpoints/a%2F..%2Fx', '/checkpoints/A.B'])
    assert.equal((await at(bad, { method: 'PUT', body: JSON.stringify({ steps }) })).status, 404);
  assert.deepEqual(readdirSync(dir), ['checkpoints']);
});

// The column's source link. Breaks: a mention of the key (an exit naming `room.a`) wins over its
// definition in text.json; inline prose (no key in any file) finds nothing; the editor is not run.
test('open: a text key opens its definition, inline prose its words, in LOKA_EDITOR', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-live-'));
  mkdirSync(join(dir, 'rooms'));
  writeFileSync(
    join(dir, 'rooms/a.json'),
    '{\n  "key": "a",\n  "name": "line two",\n  "details": {"room.a": "line three"}\n}\n',
  );
  writeFileSync(join(dir, 'text.json'), '{\n  "room.a": "line one"\n}\n');
  writeFileSync(join(dir, 'one.json'), '{"room.c": "line four"}\n');
  assert.equal(sourceOf(dir, 'room.a'), 'text.json:2');
  assert.equal(sourceOf(dir, 'rooms.a.name', 'line two'), 'rooms/a.json:3');
  assert.equal(sourceOf(dir, 'room.c'), 'one.json:1');
  assert.equal(sourceOf(dir, 'room.b', 'line five'), undefined);
  const log = join(dir, 'opened');
  writeFileSync(join(dir, 'ed'), `#!/bin/sh\n[ "$1" = --goto ] && printf %s "$2" > ${log}\n`, {
    mode: 0o755,
  });
  process.env.LOKA_EDITOR = `${join(dir, 'ed')} --goto`; // split on spaces, no shell
  const port = 20000 + Math.floor(Math.random() * 20000);
  const server = serve(port, dir, join(dir, 'none.json'));
  t.after(() => server.close());
  const post = (path: string, sent: object) =>
    fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', body: JSON.stringify(sent) });
  const opened = await post('/open', { key: 'room.a' });
  assert.equal(opened.status, 200);
  assert.equal(await opened.json(), 'text.json:2');
  for (let i = 0; i < 50 && !existsSync(log); i++) await new Promise((r) => setTimeout(r, 20));
  assert.equal(readFileSync(log, 'utf8'), `${join(dir, 'text.json')}:2`);
  assert.equal((await post('/open', { key: 'room.b', words: 'line five' })).status, 404);
  assert.equal((await fetch(`http://127.0.0.1:${port}/open`)).status, 404); // a GET is not a post
  const bad = await fetch(`http://127.0.0.1:${port}/open`, { method: 'POST', body: '{' });
  assert.equal(bad.status, 400);
  // Break: no Origin check, and any page the author visits can run LOKA_EDITOR (status 200)
  const foreign = await fetch(`http://127.0.0.1:${port}/open`, {
    method: 'POST',
    headers: { origin: 'http://evil.example' },
    body: JSON.stringify({ key: 'room.a' }),
  });
  assert.equal(foreign.status, 403);
  // the explainer takes one run: a start over's earlier rows are not sent to it
  const run = (id: string) => `{"data":{},"event":"trace.run","ids":{"run_id":"${id}"}}`;
  const step = (id: string) => `{"data":{},"event":"trace.command","ids":{"run_id":"${id}"}}`;
  assert.deepEqual(lastRun([run('a'), step('a'), run('b'), step('b')]), [run('b'), step('b')]);
  assert.deepEqual(lastRun([step('a')]), []);
  assert.deepEqual(lastRun([run('a')]), [run('a')]); // the first row counts
  assert.deepEqual(lastRun([step('a'), run('b')]), [run('b')]); // so does the last
  const no = await post('/why', { trace: [] });
  assert.equal(no.status, 400);
  assert.equal(await no.json(), 'no run in the trace');
  // a recorded run against the artifact the page runs reaches the explainer (why.test.ts W1)
  const root = join(import.meta.dirname, '../../../');
  const rows = readFileSync(`${root}cartridges/scene_sampler/transcripts/scene.jsonl`, 'utf8')
    .trim()
    .split('\n');
  const scene = serve(port + 1, dir, `${root}protocol/fixtures/cartridge_scene_hash.json`);
  t.after(() => scene.close());
  const told = await fetch(`http://127.0.0.1:${port + 1}/why`, {
    method: 'POST',
    body: JSON.stringify({ trace: ['{"event":"trace.run","ids":{"run_id":"old"}}', ...rows] }),
  });
  assert.equal(told.status, 200, await told.clone().text());
  const { reactions } = (await told.json()) as { reactions: { rule: string; fired: number }[] };
  assert.equal(reactions.find((r) => r.rule.endsWith('reaction/bell_after'))?.fired, 1);
});
