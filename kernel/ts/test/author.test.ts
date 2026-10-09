// `bin/loka dev` (play/author.ts) with a stub compiler on PATH: the rooms known-answer artifact
// stands in for a good compile, so no Elixir runs here.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
// `mise exec -- mix loka.compile <src> <artifact>`: the artifact is $6.
writeFileSync(
  join(dir, 'mise'),
  '#!/bin/sh\n[ -n "$STUB_ERR" ] && { echo "$STUB_ERR" >&2; exit 1; }\ncp "$STUB_ART" "$6"\n',
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

  const diag =
    '{"code":"UNRESOLVED_REFERENCE","data":{"target":"room.nope"},"path":"rooms/a.title","severity":"error"}';
  const failed = dev({ STUB_ERR: diag });
  assert.equal(failed.status, 1);
  assert.match(
    failed.stderr,
    /error at rooms\/a\.title: unresolved reference \(target "room\.nope"\)/,
  );
  assert.equal(readFileSync(out, 'utf8'), last);

  const forged = join(dir, 'forged.json');
  writeFileSync(forged, `{"cartridge":${kat.canonical},"content_hash":"${'0'.repeat(64)}"}`);
  assert.equal(dev({ STUB_ART: forged }).status, 1);
  assert.equal(readFileSync(out, 'utf8'), last);
});
