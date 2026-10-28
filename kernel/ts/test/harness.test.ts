// The shared stream's own guarantees, on the rest hash fixture's cartridge.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newWorld } from '../src/index.ts';
import type { Cartridge } from '../src/runtime/decision.ts';
import { commands, ctx, load } from './harness.ts';

const loaded = load('protocol/fixtures/cartridge_rest_hash.json');
assert.ok(loaded.ok, JSON.stringify(loaded));
const fresh = () =>
  newWorld(
    loaded.cartridge as Cartridge,
    ctx('0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f'),
    [1, 2, 3, 4],
  );

// Breaks: play returning a refused step's world instead of failing the test.
test('play fails on a step that is not accepted; send returns it', () => {
  const s = commands('eeeeeeee-0000-4000-8000');
  assert.notEqual(s.send(fresh(), { type: 'no_such_command' }).decision.kind, 'accepted');
  assert.throws(() => s.play(fresh(), { type: 'no_such_command' }), /accepted/);
});
