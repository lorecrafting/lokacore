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
// environment is fixed at spawn, names the artifact to copy in the file $STUB_WHICH.
writeFileSync(
  join(dir, 'mise'),
  '#!/bin/sh\n[ "$4" = loka.lint ] && { echo "items/x.json: unused" >&2; exit 1; }\n[ -n "$STUB_ERR" ] && { echo "$STUB_ERR" >&2; exit 1; }\n' +
    '[ -n "$STUB_WHICH" ] && STUB_ART=$(cat "$STUB_WHICH")\ncp "$STUB_ART" "$6"\n',
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
  const port = 20000 + Math.floor(Math.random() * 20000);
  const watcher = spawn(process.execPath, [`${ROOT}kernel/ts/play/author.ts`, src, '--watch'], {
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      LOKA_DEV_CARTRIDGE: out,
      LOKA_AUTHOR_PORT: String(port),
      STUB_WHICH: which,
    },
  });
  t.after(() => watcher.kill());
  const settle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const until = async (ready: () => boolean) => {
    for (let i = 0; i < 100 && !ready(); i++) await settle(50);
    assert.ok(ready(), 'timed out');
  };
  const messages: { text: Record<string, string>; said: string[]; compiled: boolean }[] = [];
  const stream = await (async function connect(): Promise<Response> {
    return fetch(`http://127.0.0.1:${port}/events`).catch(() => settle(50).then(connect));
  })();
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
    messages.some((m) => (m as { lint?: string[] }).lint?.[0] === 'items/x.json: unused'),
  );
  await settle(400); // the compile that follows the quick push
  assert.equal(readFileSync(out, 'utf8'), first);
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

  // Break: a kernel refusal has no `error:` line, so a panel reading the lines badges it compiled.
  writeFileSync(join(dir, 'refused.json'), '{"cartridge":{},"content_hash":"00"}');
  writeFileSync(which, join(dir, 'refused.json'));
  writeFileSync(join(src, 'rooms.json'), '{ }');
  await until(() => messages.at(-1)!.compiled === false);
  assert.match(messages.at(-1)!.said.join(), /kernel refuses/);
  reader.cancel();
});
