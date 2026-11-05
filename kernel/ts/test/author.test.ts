// `bin/loka dev` (play/author.ts) with a stub compiler on PATH: the rooms known-answer artifact
// stands in for a good compile, so no Elixir runs here.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT } from '../play/obs.ts';
import { read } from './read.ts';

const kat = read('protocol/fixtures/cartridge_rooms_hash.json');
const dir = mkdtempSync(join(tmpdir(), 'loka-author-'));
const out = join(dir, 'current.json');
const good = join(dir, 'good.json');
writeFileSync(good, `{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`);
// `mise exec -- mix loka.compile <src> <artifact>`: the artifact is $6; a watch test, whose
// environment is fixed at spawn, names the artifact to copy in the file $STUB_WHICH. `--serve` (the
// resident) records its pid in $STUB_WHICH.serve and compiles each tab-separated stdin line.
writeFileSync(
  join(dir, 'mise'),
  '#!/bin/sh\n[ "$4" = loka.lint ] && { [ -f "$STUB_WHICH.slow" ] && sleep 1; echo "items/x.json: lint of $(basename "$(cat "$STUB_WHICH")")" >&2; exit 1; }\n[ -n "$STUB_ERR" ] && { echo "$STUB_ERR" >&2; exit 1; }\n' +
    // a compile logs its start and end, and waits while $STUB_WHICH.block exists
    'c() { [ -n "$STUB_WHICH" ] && STUB_ART=$(cat "$STUB_WHICH")\n' +
    'L="$STUB_WHICH.log"; [ -n "$STUB_WHICH" ] || L=/dev/null; echo "start $(basename "$STUB_ART")" >> "$L"\n' +
    'while [ -n "$STUB_WHICH" ] && [ -f "$STUB_WHICH.block" ]; do sleep 0.05; done\n' +
    'cp "$STUB_ART" "$1"; echo "end $(basename "$STUB_ART")" >> "$L"; }\n' +
    '[ "$5" = --serve ] || { c "$6"; exit; }\necho $$ >> "$STUB_WHICH.serve"\n' +
    'while IFS="$(printf \'\\t\')" read -r s a rest; do c "$a"; echo \'loka.compile {"status":0,"stderr":""}\'; done\n',
);
chmodSync(join(dir, 'mise'), 0o755);

const dev = (env: Record<string, string>) =>
  spawnSync(process.execPath, [`${ROOT}kernel/ts/play/author.ts`, dir], {
    encoding: 'utf8',
    env: { PATH: `${dir}:${process.env.PATH}`, LOKA_DEV_CARTRIDGE: out, STUB_ART: good, ...env },
  });

// Breaks: a failed compile, or an artifact the kernel refuses (here a wrong content hash), replaces
// or removes the last good preview artifact, or exits 0 so the author thinks it is live.
test('a failed compile or a refused artifact keeps the last good artifact', () => {
  assert.equal(dev({}).status, 0);
  assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')), {
    canonical: kat.canonical,
    sha256: kat.sha256,
  });
  const last = readFileSync(out, 'utf8');

  const diag = 'error: rooms/a.json:3 Nothing is called `nope`. Fix the name.';
  const failed = dev({ STUB_ERR: `compile noise\n${diag}` });
  assert.equal(failed.status, 1);
  assert.ok(failed.stderr.includes(diag));
  assert.ok(!failed.stderr.includes('compile noise'));
  assert.equal(readFileSync(out, 'utf8'), last);

  const forged = join(dir, 'forged.json');
  writeFileSync(forged, `{"cartridge":${kat.canonical},"content_hash":"${'0'.repeat(64)}"}`);
  assert.equal(dev({ STUB_ART: forged }).status, 1);
  assert.equal(readFileSync(out, 'utf8'), last);
});

// Fast loop (docs/system/cartridge.md#author-preview). Breaks: a text-only edit rewrites the
// artifact (so the page reloads, and a fast-path result reaches a file Metro bundles), or a
// structural edit is pushed as words and never written.
test('watch: a text edit is pushed in place, a structural edit is written', async (t) => {
  const src = join(dir, 'src');
  mkdirSync(src);
  const which = join(dir, 'which');
  writeFileSync(which, good);
  const watcher = spawn(process.execPath, [`${ROOT}kernel/ts/play/author.ts`, src, '--watch'], {
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      LOKA_DEV_CARTRIDGE: out,
      LOKA_AUTHOR_PORT: '0', // a free port: random ones collided
      STUB_WHICH: which,
    },
  });
  t.after(() => watcher.kill());
  const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const until = async (ready: () => boolean) => {
    for (let i = 0; i < 100 && !ready(); i++) await settle(50);
    assert.ok(ready(), 'timed out');
  };
  type Timings = { kind: string; compile: number; publish: number; sha256?: string };
  const messages: {
    text: Record<string, string>;
    said: string[];
    compiled: boolean;
    timings?: Timings;
  }[] = [];
  let said = '';
  watcher.stdout.on('data', (chunk) => (said += chunk));
  await until(() => /port \d+\n/.test(said)); // the whole line, not a cut-off port
  const port = /port (\d+)/.exec(said)![1];
  const stream = await fetch(`http://127.0.0.1:${port}/events`);
  await until(() => existsSync(out) && JSON.parse(readFileSync(out, 'utf8')).sha256 === kat.sha256);
  const first = readFileSync(out, 'utf8');
  const reader = stream.body!.getReader();
  (async () => {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read())
      for (const line of new TextDecoder().decode(chunk.value).split('\n'))
        if (line.startsWith('data: ')) messages.push(JSON.parse(line.slice(6)));
  })();

  const edited = kat.canonical.replace(/("room\.boathouse\.description":")[^"]*"/, '$1line one"');
  assert.notEqual(edited, kat.canonical);
  const sha = createHash('sha256').update(edited).digest('hex');
  writeFileSync(join(dir, 'edited.json'), `{"cartridge":${edited},"content_hash":"${sha}"}`);
  writeFileSync(which, join(dir, 'edited.json'));
  writeFileSync(join(src, 'text.json'), '{"room.boathouse.description":"line one"}');
  await until(() => messages.some((m) => m.text['room.boathouse.description'] === 'line one'));
  // Break: the watcher never lints, or only at its start: this line arrives after the edit's compile
  await until(() =>
    messages.some(
      (m) => (m as { lint?: string[] }).lint?.[0] === 'items/x.json: lint of edited.json',
    ),
  );
  await settle(400); // the compile that follows the quick push
  assert.equal(readFileSync(out, 'utf8'), first);
  // Break: the editor's console has no timing for a prose edit, or files it as structural.
  const prose = messages.at(-1)!.timings!;
  assert.equal(prose.kind, 'prose');
  assert.ok(prose.compile >= 0 && prose.publish >= 0);
  assert.deepEqual(messages.at(-1)!.text, { 'room.boathouse.description': 'line one' });

  const rest = read('protocol/fixtures/cartridge_rest_hash.json');
  writeFileSync(
    join(dir, 'rest.json'),
    `{"cartridge":${rest.canonical},"content_hash":"${rest.sha256}"}`,
  );
  writeFileSync(which, join(dir, 'rest.json'));
  writeFileSync(join(src, 'rooms.json'), '{}');
  await until(() => readFileSync(out, 'utf8') !== first);
  assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')), {
    canonical: rest.canonical,
    sha256: rest.sha256,
  });
  await until(() => messages.at(-1)!.text['room.boathouse.description'] === undefined);
  assert.equal(messages.at(-1)!.compiled, true);
  // Break: a structural timing lacks the sha256 the Book's `ready` is matched against.
  assert.deepEqual(
    [messages.at(-1)!.timings!.kind, messages.at(-1)!.timings!.sha256],
    ['structural', rest.sha256],
  );

  await until(
    () => (messages.at(-1) as { lint?: string[] }).lint?.[0] === 'items/x.json: lint of rest.json',
  );

  // Break: a kernel refusal has no `error:` line, so a panel reading the lines badges it compiled.
  writeFileSync(join(dir, 'refused.json'), '{"cartridge":{},"content_hash":"00"}');
  writeFileSync(which, join(dir, 'refused.json'));
  writeFileSync(join(src, 'rooms.json'), '{ }');
  await until(() => messages.at(-1)!.compiled === false);
  assert.match(messages.at(-1)!.said.join(), /kernel refuses/);
  assert.equal(messages.at(-1)!.timings!.kind, 'refusal');
  // Break: the lint of the last good compile still shows, as if it read the refused source.
  assert.equal((messages.at(-1) as { lint?: string[] }).lint, undefined);

  // Break: a lint still running when a save's compile fails reports afterwards, so the findings of
  // the source that no longer compiles show as the current ones.
  writeFileSync(`${which}.slow`, '');
  writeFileSync(which, join(dir, 'rest.json'));
  const before = messages.length;
  writeFileSync(join(src, 'rooms.json'), '{  }');
  await until(() => messages.length > before && messages.at(-1)!.compiled === true);
  const seen = messages.length;
  writeFileSync(which, join(dir, 'refused.json'));
  writeFileSync(join(src, 'rooms.json'), '{   }');
  await until(() => messages.length > seen && messages.at(-1)!.compiled === false);
  await settle(1500); // the slow lint ends
  assert.deepEqual(
    messages.slice(seen).filter((m) => (m as { lint?: string[] }).lint),
    [],
  );

  // Hold. Breaks: a structural compile written while the editor holds (Metro reloads mid-edit),
  // or the Hold's end never writing what waited.
  rmSync(`${which}.slow`);
  const hold = (on: boolean) =>
    fetch(`http://127.0.0.1:${port}/hold`, { method: 'POST', body: JSON.stringify({ on }) });
  await hold(true);
  const held = readFileSync(out, 'utf8');
  writeFileSync(which, good);
  writeFileSync(join(src, 'rooms.json'), '{    }');
  await until(() => (messages.at(-1) as { pending?: number }).pending === 1);
  assert.equal(readFileSync(out, 'utf8'), held);
  // Break: a text.json save while a build is parked overlays words on the page the Hold keeps.
  const parkedAt = messages.length;
  writeFileSync(join(src, 'text.json'), '{"room.boathouse.description":"line two"}');
  await until(() => (messages.at(-1) as { pending?: number }).pending === 2);
  assert.ok(
    !messages.slice(parkedAt).some((m) => m.text?.['room.boathouse.description'] === 'line two'),
  );
  // Break: the Hold's end pushes the parked build as compiled over a later failed save.
  writeFileSync(which, join(dir, 'refused.json'));
  writeFileSync(join(src, 'rooms.json'), '{     }');
  await until(() => messages.at(-1)!.compiled === false);
  const at = messages.length;
  await hold(false);
  await until(() => JSON.parse(readFileSync(out, 'utf8')).sha256 === kat.sha256);
  await until(() => messages.slice(at).some((m) => (m as { pending?: number }).pending === 0));
  await settle(100);
  assert.equal(messages.at(-1)!.compiled, false);
  // Break: a compile that wrote no diagnostics file (the stub never does) leaves the last build's
  // cards up; it clears them.
  assert.ok(messages.some((m) => (m as { diagnostics?: unknown[] }).diagnostics?.length === 0));
  // Break: the Hold's end with nothing parked writes an empty build (a 500).
  await hold(true);
  assert.equal((await hold(false)).status, 200);
  reader.cancel();
});

// The compile queue. Breaks: the compile blocks the watcher (spawnSync), so /source and the page's
// writes wait on mix; or two saves compile at once or out of order, so the older one's artifact
// is the one written.
test('watch: the watcher answers during a compile, and saves compile one at a time in order', async (t) => {
  const src = join(dir, 'queued');
  mkdirSync(src);
  writeFileSync(join(src, 'rooms.json'), '{}');
  const which = join(dir, 'queued-which');
  writeFileSync(which, good);
  const rest = read('protocol/fixtures/cartridge_rest_hash.json');
  writeFileSync(
    join(dir, 'rest.json'),
    `{"cartridge":${rest.canonical},"content_hash":"${rest.sha256}"}`,
  );
  const artifact = join(dir, 'queued.json');
  const watcher = spawn(process.execPath, [`${ROOT}kernel/ts/play/author.ts`, src, '--watch'], {
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      LOKA_DEV_CARTRIDGE: artifact,
      LOKA_AUTHOR_PORT: '0', // a free port: random ones collided
      STUB_WHICH: which,
    },
  });
  t.after(() => watcher.kill());
  const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const log = () => (existsSync(`${which}.log`) ? readFileSync(`${which}.log`, 'utf8') : '');
  const until = async (ready: () => boolean) => {
    for (let i = 0; i < 100 && !ready(); i++) await settle(50);
    assert.ok(ready(), 'timed out');
  };
  let said = '';
  watcher.stdout.on('data', (chunk) => (said += chunk));
  await until(() => /port \d+\n/.test(said)); // the whole line, not a cut-off port
  const port = /port (\d+)/.exec(said)![1];
  let events = '';
  const reader = (await fetch(`http://127.0.0.1:${port}/events`)).body!.getReader();
  (async () => {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read())
      events += new TextDecoder().decode(chunk.value);
  })().catch(() => {}); // the stream ends with the watcher
  await settle(200); // the fs watch is live
  writeFileSync(`${which}.block`, '');
  writeFileSync(join(src, 'rooms.json'), '{ }');
  await until(() => log().endsWith('start good.json\n'));
  const answered = await fetch(`http://127.0.0.1:${port}/source?file=rooms.json`, {
    signal: AbortSignal.timeout(2000),
  });
  assert.equal(((await answered.json()) as { bytes: string }).bytes, '{ }');
  writeFileSync(which, join(dir, 'rest.json'));
  writeFileSync(join(src, 'rooms.json'), '{  }');
  await settle(400); // past the debounce: the second save waits in the queue
  writeFileSync(join(src, 'rooms.json'), '{   }');
  await settle(400); // a third joins the waiting one: no compile of its own
  rmSync(`${which}.block`);
  await until(() => JSON.parse(readFileSync(artifact, 'utf8')).sha256 === rest.sha256);
  assert.equal(
    log(),
    'start good.json\nend good.json\nstart good.json\nend good.json\nstart rest.json\nend rest.json\n',
  );
  // Break: the watcher boots a compiler per save instead of keeping one resident.
  assert.equal(readFileSync(`${which}.serve`, 'utf8').split('\n').length, 2);
  // Break: a compile that ends after a later save is written, so its older words replace the
  // page's newer ones until the next compile. No wall time: the watcher's push of the save is the
  // proof it saw it, and every compile after the blocked one is refused, so only it could write kat.
  writeFileSync(which, good);
  writeFileSync(`${which}.block`, '');
  writeFileSync(join(src, 'rooms.json'), '{}');
  await until(() => log().endsWith('start good.json\n'));
  const refused = join(dir, 'queued-refused.json');
  writeFileSync(refused, '{"cartridge":{},"content_hash":"00"}');
  writeFileSync(which, refused);
  writeFileSync(join(src, 'rooms.json'), '{      }');
  const later = createHash('sha256').update('{      }').digest('hex'); // not the first save's push
  await until(() => events.includes(later));
  rmSync(`${which}.block`);
  await until(() => log().endsWith('end queued-refused.json\n'));
  assert.equal(JSON.parse(readFileSync(artifact, 'utf8')).sha256, rest.sha256);
  // Break: the compile after a discarded one is discarded too, so the newest good save never shows.
  writeFileSync(which, good);
  writeFileSync(join(src, 'rooms.json'), '{ }');
  await until(() => JSON.parse(readFileSync(artifact, 'utf8')).sha256 === kat.sha256);
  reader.cancel();
});

// Breaks: a dead resident compiler fails the save or hangs the queue instead of compiling it
// one-shot; it is never restarted; or it outlives the author (a BEAM left per world switch).
test('watch: a killed resident compiler falls back to a one-shot compile and restarts', async (t) => {
  const src = join(dir, 'resident');
  mkdirSync(src);
  const which = join(dir, 'resident-which');
  writeFileSync(which, good);
  const artifact = join(dir, 'resident.json');
  const watcher = spawn(process.execPath, [`${ROOT}kernel/ts/play/author.ts`, src, '--watch'], {
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      LOKA_DEV_CARTRIDGE: artifact,
      LOKA_AUTHOR_PORT: '0',
      STUB_WHICH: which,
    },
  });
  t.after(() => watcher.kill());
  const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const until = async (ready: () => boolean) => {
    for (let i = 0; i < 100 && !ready(); i++) await settle(50);
    assert.ok(ready(), 'timed out');
  };
  const pids = () =>
    existsSync(`${which}.serve`)
      ? readFileSync(`${which}.serve`, 'utf8').split('\n').filter(Boolean)
      : [];
  const alive = (pid: string) => {
    try {
      return process.kill(Number(pid), 0);
    } catch {
      return false;
    }
  };
  await until(
    () => existsSync(artifact) && JSON.parse(readFileSync(artifact, 'utf8')).sha256 === kat.sha256,
  );
  const [first] = pids();
  process.kill(Number(first), 'SIGKILL');
  await settle(200); // the fs watch is live
  const rest = read('protocol/fixtures/cartridge_rest_hash.json');
  writeFileSync(
    join(dir, 'rest.json'),
    `{"cartridge":${rest.canonical},"content_hash":"${rest.sha256}"}`,
  );
  writeFileSync(which, join(dir, 'rest.json'));
  writeFileSync(join(src, 'rooms.json'), '{}');
  await until(() => JSON.parse(readFileSync(artifact, 'utf8')).sha256 === rest.sha256);
  await until(() => pids().length === 2);
  const second = pids()[1];
  assert.ok(alive(second));
  watcher.kill();
  await until(() => !alive(second));
});
