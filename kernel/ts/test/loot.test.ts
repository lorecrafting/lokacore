// Toolbox row 8 on the compiled loot sampler: a rat holds a tail (chance 50) and a coin (chance
// 10); its death rolls each in table order on the world RNG (mechanics.md loot tables).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { encode } from '../src/foundation/canonical.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-loot-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/loot_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;
const RAT = 'loot_sampler@0.0.1:npc/rat';

let n = 0;
const id = () => `dddddddd-8888-4888-8888-${String(++n).padStart(12, '0')}` as never;
function accepted(r: ReturnType<typeof step>) {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
/** Move to the pit, attack the rat and run its first round (one player hit kills it); the
 * command ids restart, so a second call replays the same commands. */
function killRat(seed: number[]) {
  n = 0;
  let w: World = newWorld(content, '2d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, seed);
  const play = (payload: object) =>
    accepted(
      step(
        w,
        {
          id: id(),
          world_context_id: w.context,
          payload: { actor_id: w.character, ...payload },
        } as never,
        n,
      ),
    );
  w = play({ type: 'move', direction: 'east' });
  w = play({ type: 'attack', target_id: w.entityIds[RAT] });
  const run_id = `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const [from, until] = [w.state.clock, w.state.clock + 150];
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
  return accepted(stepElapsed(w, { ...command, world_context_id: w.context } as never, n));
}

// Breaks: drops never roll (everything transfers), a roll equal to the chance passes, the coin
// rolls before the tail, a roll is skipped, or the drawn RNG is not committed. Rolls and the final
// state are hand-computed with an independent xoshiro128** (hit draw, then tail, then coin).
test('seeded rat deaths drop the hand-computed items and commit the drawn RNG', () => {
  const rows: [number[], number[], boolean, boolean][] = [
    [[1, 1, 1, 1], [2560, 513, 262145, 5242880], false, false], // rolls 60, 20
    [[1, 2, 3, 4], [25179138, 12295, 540162, 2107404], true, false], // rolls 0, 40
    [[9, 10, 11, 12], [25191426, 8207, 2637322, 44050444], false, true], // rolls 80, 0
    [[5, 6, 7, 8], [58743810, 30731, 1601030, 23095324], true, true], // rolls 40, 0
    [
      [170029958, 3890805239, 3345768512, 779757290],
      [2053570152, 412885207, 3124839355, 1119121452],
      false,
      false,
    ], // rolls 50 (a roll equal to the chance fails), 86
  ];
  for (const [seed, rng, tail, coin] of rows) {
    const w = killRat(seed);
    const rat = w.entityIds[RAT];
    const corpse = Object.keys(w.state.created ?? {}).find(
      (e) => w.state.created![e].origin.kind === 'death',
    );
    assert.ok(corpse, 'the rat died');
    const holder = (item: string) =>
      w.state.containers[w.entityIds[`loot_sampler@0.0.1:item/${item}`]];
    assert.deepEqual(
      [holder('tail'), holder('coin'), w.state.rng],
      [tail ? corpse : rat, coin ? corpse : rat, rng],
      String(seed),
    );
    // Replay from the same seed is byte-stable.
    assert.deepEqual(encode(killRat(seed).state as never), encode(w.state as never), String(seed));
  }
});

// Breaks: the loader drops a drops check, so an artifact whose drop item the NPC does not hold, a
// repeated item, an unknown item, a missing or regenerating hp (the NPC revives and re-rolls), a
// spawn template or an old API floor loads and misplaces loot in play.
test('the loader refuses each unsound drops declaration', () => {
  const source = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  const at = `.cartridge.npcs["${RAT}"].drops`;
  const api = '.cartridge.manifest.requires.kernel_api.at_least';
  const rows: [(c: any) => void, string, string][] = [
    [(c) => (c.manifest.requires.kernel_api.at_least = '1.42'), 'KERNEL_API_RANGE_INVALID', api],
    [
      (c) => {
        delete c.world.death;
        for (const corpse of ['npc_corpse', 'player_corpse'])
          delete c.items[`loot_sampler@0.0.1:item/${corpse}`];
      },
      'SCHEMA_VIOLATION',
      at,
    ],
    [(c) => delete c.npcs[RAT].hp, 'SCHEMA_VIOLATION', at],
    [(c) => (c.npcs[RAT].hp.gain = 4), 'SCHEMA_VIOLATION', at],
    [(c) => (c.npcs[RAT].spawn_template = true), 'SCHEMA_VIOLATION', at],
    [(c) => (c.npcs[RAT].drops[1].item.key = 'tail'), 'SCHEMA_VIOLATION', `${at}[1]`],
    [(c) => (c.npcs[RAT].drops[1].item.key = 'bone'), 'UNRESOLVED_REFERENCE', `${at}[1].item`],
    [
      (c) =>
        (c.items['loot_sampler@0.0.1:item/coin'].location = { in: 'room', room: c.npcs[RAT].room }),
      'SCHEMA_VIOLATION',
      `${at}[1]`,
    ],
  ];
  for (const [change, code, path] of rows) {
    const c = structuredClone(source);
    change(c);
    const canonical = encode(c);
    const sha256 = createHash('sha256').update(canonical).digest('hex');
    const r = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
      INSTALLED,
    );
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [code, path], path);
  }
});
