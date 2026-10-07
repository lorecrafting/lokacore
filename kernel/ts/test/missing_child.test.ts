import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, type Cartridge } from '../src/index.ts';
import { KERNEL, report, simulate } from './sim.ts';
import { read } from './read.ts';

// Breaks: the active chapter is omitted from simulation or a chapter-only combination
// violates a registered invariant; the frozen demo corpus alone cannot detect either.
test('the active Missing Child release keeps the simulator invariants on controlled seeds', () => {
  const pin = read('protocol/fixtures/missing_child_v042_hash.json');
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

// Breaks: the two recoverable items shift current starting allocations without a matching independent oracle.
test('v042 fresh allocations match the independently derived release oracle', () => {
  const pin = read('protocol/fixtures/missing_child_v042_hash.json');
  const world = newWorld(pin.value, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
  const actual: Record<string, string> = {
    character: world.character,
    body: world.body,
    consumed: world.consumed!,
  };
  for (const [id, room] of Object.entries(world.rooms)) actual[`room/${room.key}`] = id;
  for (const [id, detail] of Object.entries(world.details))
    actual[`detail/${world.rooms[detail.room].key}/${detail.key}`] = id;
  for (const [id, entity] of Object.entries(world.entities)) {
    const origin = world.state.created?.[id]?.origin;
    actual[
      origin?.kind === 'spawned'
        ? `population/${origin.by.key}/slot${origin.slot}/${origin.role === 'hound' ? 'member' : origin.role}`
        : `${entity.kind}/${entity.key}`
    ] = id;
  }
  for (const [id, job] of Object.entries(world.state.jobs ?? {}))
    actual[job.job.kind === 'population' ? `population/${job.job.key}/job` : `job/${job.job.key}`] =
      id;
  for (const [slot, id] of Object.entries(world.slots)) actual[`slot/${slot}`] = id;
  assert.deepEqual(actual, read('protocol/fixtures/missing_child_v042_ids.json'));
});
