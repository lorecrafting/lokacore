import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, type Cartridge } from '../src/index.ts';
import { KERNEL, report, simulate } from './sim.ts';
import { read } from './read.ts';

// Breaks: the active chapter is omitted from simulation or a chapter-only combination
// violates a registered invariant; the frozen demo corpus alone cannot detect either.
test('the active Missing Child release keeps the simulator invariants on controlled seeds', () => {
  const pin = read('protocol/fixtures/missing_child_v034_hash.json');
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
