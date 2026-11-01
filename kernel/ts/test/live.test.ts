// Fast loop: only a change confined to text values travels as an overlay; anything structural
// does not (docs/system/cartridge.md#author-preview).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT } from '../play/obs.ts';
import { lastRun, limited, lintLines, serve, sourceOf, textOnly } from '../play/live.ts';

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
  // Break: a hand-edited checkpoint that is not JSON throws in the handler and kills the watcher.
  writeFileSync(join(dir, 'checkpoints/cellar-1.json'), '{"steps": [1,]}');
  assert.equal((await at('/checkpoints/cellar-1')).status, 500);
  assert.equal((await at('/checkpoints')).status, 200);
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
  // Break: Alt-click on a scene line answers 404, since a scene holds neither `"key":` nor a JSON
  // string; a prompt arrives joined, a choice label as itself.
  mkdirSync(join(dir, 'scenes'));
  writeFileSync(join(dir, 'scenes/s.scene'), 'npc: maud\nmaud: First.\nmaud: Second.\n- Take it\n');
  assert.equal(sourceOf(dir, 'dialogue.s.prompt', 'First.\nSecond.'), 'scenes/s.scene:2');
  assert.equal(sourceOf(dir, 'dialogue.s.label', 'Take it'), 'scenes/s.scene:4');
  // Break: an empty text value jumps to a scene's blank line.
  writeFileSync(join(dir, 'scenes/z.scene'), 'npc: a\n\na: line six\n');
  assert.equal(sourceOf(dir, 'room.b', ''), undefined);
  assert.equal(sourceOf(dir, 'room.b', '  \n'), undefined);
  // Break: Alt-click on narration or a cutscene paragraph answers 404.
  writeFileSync(join(dir, 'scenes/n.scene'), 'npc: maud\n* Rain falls.\n');
  writeFileSync(join(dir, 'scenes/c.cut'), 'Bell one.\nBell two.\n---\n');
  assert.equal(sourceOf(dir, 'dialogue.n.prompt', 'Rain falls.'), 'scenes/n.scene:2');
  assert.equal(sourceOf(dir, 'scene.c.steps.0.text', 'Bell one.\nBell two.'), 'scenes/c.cut:1');
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
  // Break: the Origin check also refuses the author's own page, served from 127.0.0.1
  const own = await fetch(`http://127.0.0.1:${port}/open`, {
    method: 'POST',
    headers: { origin: 'http://127.0.0.1:8081' },
    body: JSON.stringify({ key: 'room.a' }),
  });
  assert.equal(own.status, 200);
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
  const toScene = (sent: object) =>
    fetch(`http://127.0.0.1:${port + 1}/why`, { method: 'POST', body: JSON.stringify(sent) });
  // Break: a run with no step yet answers as a failure to explain, not with what to do
  const none = await toScene({ trace: [rows[0]] });
  assert.equal(none.status, 400);
  assert.equal(await none.json(), 'Take a step in the Book first.');
  // Break: the page gets no sentences, or the answer for the world before the last step.
  // Step 1 accepts the lantern quest, so bram's policy holds only after that step.
  const asked = await toScene({ trace: rows.slice(0, 2), dialogue: 'bram' });
  assert.equal(asked.status, 200, await asked.clone().text());
  assert.deepEqual(((await asked.json()) as { lines: unknown }).lines, [
    { text: 'quest lantern is active', ok: true, depth: 0 },
  ]);
  // Break: an artifact the kernel will not load reaches the explainer, not its own diagnostic
  writeFileSync(join(dir, 'bad.json'), '{"canonical":"{}","sha256":"x"}');
  const refused = serve(port + 2, dir, join(dir, 'bad.json'));
  t.after(() => refused.close());
  const unloaded = await fetch(`http://127.0.0.1:${port + 2}/why`, {
    method: 'POST',
    body: JSON.stringify({ trace: [run('a')] }),
  });
  assert.equal(unloaded.status, 400);
  assert.match((await unloaded.json()) as string, /"code":"UNKNOWN_FORMAT"/);
});

// Breaks: a clean run reads as findings; findings lost; a lint that crashed reads as clean, or its
// stack trace as findings.
test('lint lines: clean, findings, or a lint that did not run', () => {
  assert.deepEqual(lintLines(0, 'compiling...\n'), []);
  assert.deepEqual(lintLines(1, 'Compiling 3 files\nitems/x.json: unused\na/b.json: long line\n'), [
    'items/x.json: unused',
    'a/b.json: long line',
  ]);
  assert.deepEqual(lintLines(1, 'crash\n'), ['lint failed (exit 1)']);
  assert.deepEqual(lintLines(2, 'items/x.json: unused\n'), ['lint failed (exit 2)']);
  assert.deepEqual(lintLines(null, ''), ['lint failed (exit null)']);
});

// Break: the route is unwired, or does not decode the question, or reads the wrong source tree.
test('find is served from the source and artifact the watcher was given', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-find-route-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'text.json'), '{"a": "Old Maud"}\n');
  const port = 21000 + Math.floor(Math.random() * 20000);
  const server = serve(port, dir, join(dir, 'none.json'));
  t.after(() => server.close());
  const found = await fetch(`http://127.0.0.1:${port}/find?q=${encodeURIComponent('old maud')}`);
  assert.deepEqual(await found.json(), {
    hits: [{ at: 'text.json:1', text: '{"a": "Old Maud"}' }],
    total: 1,
    refs: [],
  });
});

test('GET /numbers: reports on the dev artifact', async (t) => {
  // Break: handing the dev {canonical, sha256} form to the reports, which refuse it.
  const dir = mkdtempSync(join(tmpdir(), 'loka-live-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const artifact = join(dir, 'dev.json');
  const server = serve(port, dir, artifact);
  t.after(() => {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const url = `http://127.0.0.1:${port}/numbers`;
  execFileSync('mix', ['loka.compile', 'cartridges/needs_sampler', join(dir, 'c.json')], {
    cwd: ROOT,
    stdio: 'pipe',
  });
  const [, canonical, sha256] = /^\{"cartridge":(.*),"content_hash":"(.*)"\}$/s.exec(
    readFileSync(join(dir, 'c.json'), 'utf8'),
  )!;
  writeFileSync(artifact, JSON.stringify({ canonical, sha256 }));
  const told = (await (await fetch(url)).json()) as {
    hash: string;
    pacing: { report: { levels: null; pools: { pools: { pool: string; empty: unknown }[] } } };
    fights: { report: { targets: unknown[] } };
  };
  assert.equal(told.hash, sha256);
  assert.equal(told.pacing.report.levels, null);
  const hunger = told.pacing.report.pools.pools.find((p) => p.pool.endsWith('resource/hunger'));
  assert.deepEqual(hunger?.empty, { seeds: 4, hour: 10 });
  assert.deepEqual(told.fights.report.targets, []);
});

test('limited: a report past its limit is killed and says so; a failing one gives its words', async () => {
  // Break: no kill, so a slow cartridge hangs the panel; or a failure shown as an empty report.
  const slow = await limited(['-e', 'setTimeout(() => {}, 9000)'], 1);
  assert.ok('why' in slow && /^timed out after 1 s/.test(slow.why), JSON.stringify(slow));
  const bad = await limited(['-e', 'console.error("no such foe"); process.exit(1)'], 5);
  assert.deepEqual(bad, { why: 'no such foe' });
});
