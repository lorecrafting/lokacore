// The feature map's example transcripts (docs/features.gen.md; bin/features.exs):
// cartridges/<cartridge>/transcripts/<capability>.jsonl, each a game_trace that must replay
// byte for byte on this kernel against its cartridge's known-answer artifact
// (protocol/fixtures/cartridge_*hash.json, matched by manifest id) and exercise a command its
// capability owns. Breaks: a kernel change that alters a recorded decision, or a transcript
// filed under a capability it never uses.
import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { test } from 'node:test';
import { CAPABILITY_OWNERS } from '../src/contracts.gen.ts';
import { INSTALLED, loadCartridge, type Cartridge } from '../src/index.ts';
import { ROOT, line } from '../play/obs.ts';
import { replayRecords } from '../play/replay.ts';
import { decideReplay, header, start } from '../play/run.ts';

const kats = [
  'protocol/fixtures/cartridge_*hash.json',
  'protocol/fixtures/containers_*hash.json',
  'protocol/fixtures/missing_child_*hash.json',
].flatMap((p) => globSync(p, { cwd: ROOT }).map((rel) => readFileSync(ROOT + rel, 'utf8')));
const transcripts = globSync('cartridges/*/transcripts/*.jsonl', { cwd: ROOT });

test('every example transcript replays and exercises its capability', () => {
  assert.ok(transcripts.length >= 2);
  for (const rel of transcripts) {
    const [, cartridge, , file] = rel.split('/');
    const pin = JSON.parse(readFileSync(ROOT + rel, 'utf8').split('\n')[0]).ids.content_hash;
    // Only a fixture whose text names the pin can be its known answer; parse just those.
    const kat = kats
      .filter((text) => text.includes(pin))
      .map((text) => JSON.parse(text))
      .find((k) => k.value.manifest.id === cartridge && k.sha256 === pin);
    assert.ok(kat, `${rel}: no known answer for ${cartridge}`);
    const loaded = loadCartridge(
      Buffer.from(`{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`),
      INSTALLED,
    );
    assert.ok(loaded.ok, `${rel}: ${JSON.stringify(loaded)}`);
    const { file: bytes, head, entries } = replayRecords(ROOT + rel, loaded.hash);
    const r = start(
      loaded.cartridge as Cartridge,
      loaded.hash,
      head.ids.run_id,
      head.data.world_context_id,
      head.ids.seed,
      head.ids.kernel_version,
    );
    const out =
      header(r) + entries.map((e) => line(decideReplay(r, e.data.command).trace)).join('');
    assert.equal(out, bytes, `${rel}: replay differs`);
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
