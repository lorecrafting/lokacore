// The feature map's example transcripts (docs/features.gen.md; bin/features.exs):
// cartridges/<cartridge>/transcripts/<capability>.jsonl, each a game_trace that must replay
// byte for byte on this kernel against its cartridge's known-answer artifact
// (protocol/fixtures/cartridge_*hash.json, matched by manifest id) and exercise a command its
// capability owns. Breaks: a kernel change that alters a recorded decision, or a transcript
// filed under a capability it never uses.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { globSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { test } from 'node:test';
import { CAPABILITY_OWNERS } from '../src/contracts.gen.ts';
import { ROOT } from '../play/obs.ts';
import { read } from './read.ts';

const dir = mkdtempSync(join(tmpdir(), 'r5s2-transcripts-'));
const kats = globSync('protocol/fixtures/cartridge_*hash.json', { cwd: ROOT }).map(read);
const transcripts = globSync('cartridges/*/transcripts/*.jsonl', { cwd: ROOT });

test('every example transcript replays and exercises its capability', () => {
  assert.ok(transcripts.length >= 2);
  for (const rel of transcripts) {
    const [, cartridge, , file] = rel.split('/');
    const kat = kats.find((k) => k.value.manifest.id === cartridge);
    assert.ok(kat, `${rel}: no known answer for ${cartridge}`);
    const artifact = join(dir, `${cartridge}.json`);
    writeFileSync(artifact, `{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`);
    const r = spawnSync(
      'node',
      [`${ROOT}kernel/ts/play/main.ts`, artifact, '--replay', ROOT + rel],
      {
        encoding: 'utf8',
      },
    );
    assert.equal(r.status, 0, `${rel}: ${r.stdout}${r.stderr}`);
    const capability = basename(file, '.jsonl');
    const owners = readFileSync(ROOT + rel, 'utf8')
      .split('\n')
      .filter(Boolean)
      .slice(1)
      .map((l) => CAPABILITY_OWNERS.command[JSON.parse(l).data.command.payload.type]);
    assert.ok(
      owners.some((o) => o?.startsWith(`${capability}@`)),
      `${rel}: no ${capability} command`,
    );
  }
});
