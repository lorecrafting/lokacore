import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld } from '../src/index.ts';
import { read } from './read.ts';

// The synthetic E2 cartridge (cartridges/r9c_interactions): its compiled bytes equal this pin
// (test/loka/content_r9c_interactions_test.exs); its answers come from Python
// (test/loka/cartridge_r9c_interactions_hash.py), never from either kernel.
const pin = read('protocol/fixtures/r9c_interactions_hash.json');
const load = (canonical: string) => {
  const hash = createHash('sha256').update(canonical).digest('hex');
  const artifact = `{"cartridge":${canonical},"content_hash":"${hash}"}`;
  return loadCartridge(new TextEncoder().encode(artifact), INSTALLED);
};

// Breaks: the TypeScript loader refuses, re-hashes or re-locks the compiler's exact bytes, or
// the synthetic world's starting identities drift from the independent allocation oracle.
test('the synthetic artifact loads with its pinned hash and lock and allocates the oracle IDs', () => {
  const loaded = load(pin.canonical);
  assert.ok(loaded.ok);
  assert.equal(loaded.hash, pin.sha256);
  assert.deepEqual(JSON.parse(JSON.stringify(loaded.cartridge.lock)), pin.value.lock);
  const world = newWorld(
    loaded.cartridge as never,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
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
  assert.deepEqual(actual, read('protocol/fixtures/r9c_interactions_ids.json'));
});

// Breaks: a malformed or uninstalled-capability variant of this cartridge reaches world
// creation; the loader is the only path to a world, so a refusal here means none exists.
test('malformed and unknown-capability variants are refused before any world exists', () => {
  const unknown = pin.canonical.replaceAll(
    '"capabilities":{"action_recipe":1',
    '"capabilities":{"aardvark":1,"action_recipe":1',
  );
  const malformed = pin.canonical.replace('"title":"R9C interactions (synthetic)",', '');
  for (const [canonical, code, path] of [
    [unknown, 'CAPABILITY_NOT_INSTALLED', '.cartridge.lock.capabilities.aardvark'],
    [malformed, 'SCHEMA_VIOLATION', '.cartridge.manifest.title'],
  ]) {
    assert.notEqual(canonical, pin.canonical);
    const loaded = load(canonical);
    assert.equal(loaded.ok, false);
    assert.deepEqual([loaded.diagnostic.code, loaded.diagnostic.path], [code, path]);
  }
});
