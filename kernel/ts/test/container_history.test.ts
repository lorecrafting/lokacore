import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encode, hash } from '../src/foundation/canonical.ts';
import { read } from './read.ts';

// Breaks: a frozen encoding/hash answer changes. Historical bytes are evidence, not a fallback.
test('historical artifacts retain their canonical answers', () => {
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
  ]) {
    const pin = read(`protocol/fixtures/${name}_hash.json`);
    assert.equal(encode(pin.value), pin.canonical, name);
    assert.equal(hash(pin.value), pin.sha256, name);
  }
});
