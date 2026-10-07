import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, type Cartridge } from '../src/index.ts';
import { KERNEL, report, simulate } from './sim.ts';
import { read } from './read.ts';

// Breaks: the active chapter is omitted from simulation or a chapter-only combination
// violates a registered invariant; the frozen demo corpus alone cannot detect either.
test('the active Missing Child release keeps the simulator invariants on controlled seeds', () => {
  const pin = read('protocol/fixtures/missing_child_v041_hash.json');
  const artifact = `{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`;
  const loaded = loadCartridge(new TextEncoder().encode(artifact), INSTALLED);
  assert.ok(loaded.ok);
  const corpus = [{ cartridge: loaded.cartridge as Cartridge, hash: loaded.hash, artifact }];
  for (let seed = 1; seed <= 32; seed++) {
    const outcome = simulate(seed, KERNEL, corpus);
    assert.equal(outcome.loaded.cartridge.manifest.id, 'ashmere_missing_child');
    assert.equal(outcome.failure, undefined, outcome.failure ? report(outcome) : '');
    assert.ok(outcome.commands.length > 0);
  }
});

// Breaks: the D8 successor shifts any fresh identity allocation despite retaining the published chapter geometry.
test('the D8 successor keeps its independently pinned fresh IDs', () => {
  const pin = read('protocol/fixtures/missing_child_v039_hash.json');
  const ids = read('protocol/fixtures/missing_child_v039_ids.json');
  const loaded = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`),
    INSTALLED,
  );
  assert.ok(loaded.ok);
  const world = newWorld(
    (loaded as { cartridge: Cartridge }).cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  assert.equal(world.character, ids.character);
  assert.equal(world.body, ids.body);
  for (const [name, id] of Object.entries(ids)) {
    const [kind, room, detail] = name.split('/');
    if (kind === 'room')
      assert.equal(world.roomIds[`ashmere_missing_child@0.0.39:room/${room}`], id, name);
    if (kind === 'detail')
      assert.equal(
        Object.entries(world.details).find(
          ([, d]) =>
            d.key === detail &&
            d.room === world.roomIds[`ashmere_missing_child@0.0.39:room/${room}`],
        )?.[0],
        id,
        name,
      );
    if (kind === 'item' || kind === 'npc')
      assert.equal(world.entityIds[`ashmere_missing_child@0.0.39:${kind}/${room}`], id, name);
  }
});
