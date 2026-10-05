import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encode, hash } from '../src/foundation/canonical.ts';
import { loadCartridge, INSTALLED } from '../src/index.ts';
import { read } from './read.ts';

// Breaks: a frozen encoding/hash answer changes, or the current loader silently treats
// historical unmarked holders as containers. Historical bytes are evidence, not a fallback.
test('historical artifacts retain their canonical answers and refuse unmarked receptacles', () => {
  for (const name of [
    'cartridge_items',
    'cartridge_locks',
    'sampler_v006',
    'sampler_v007',
    'sampler_v008',
    'sampler_v009',
    'sampler_v010',
    'cartridge_sampler',
    'reward_storage',
    'missing_child_v001',
    'missing_child_v002',
  ]) {
    const pin = read(`protocol/fixtures/${name}_hash.json`);
    assert.equal(encode(pin.value), pin.canonical, name);
    assert.equal(hash(pin.value), pin.sha256, name);
    const result = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`),
      INSTALLED,
    );
    assert.equal(result.ok, false, name);
    if (!result.ok) assert.equal(result.diagnostic.code, 'SCHEMA_VIOLATION', name);
  }
});
