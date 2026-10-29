import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { read } from './read.ts';
import { bundle, prefix, ref } from './reward_storage_fixture.ts';
import { validate } from '../src/foundation/validate.ts';
import { encode } from '../src/foundation/canonical.ts';
import { loadCartridge, INSTALLED } from '../src/index.ts';

const load = (change: (c: any) => void) => {
  const c = structuredClone(bundle.value);
  change(c);
  const canonical = encode(c),
    content_hash = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(JSON.stringify({ cartridge: c, content_hash })),
    INSTALLED,
  );
};

// Breaks: the loader omits semantic role/type/reserved-write checks.
test('portable loader rejects malformed reward roles, types and reserved writes', () => {
  assert.ok(load(() => {}).ok);
  for (const c of read('protocol/fixtures/reward_storage_invalid.json')) {
    // The scene fact's reservation is the compiler's (content_reward_storage_test.exs).
    if (c.code === 'RESERVED_FACT' && !c.loader_code) continue;
    const result = load((v) => {
      v.barriers[`${prefix}:barrier/reward_lid`].initial = 'open';
      const d = v.dialogues[`${prefix}:dialogue/maud_turn_in`];
      let at = d;
      for (const k of c.path.slice(0, -1)) at = at[k];
      const value = structuredClone(c.value);
      if (c.path.at(-1) === 'sequence')
        for (const step of value) step.fact = ref('fact', step.fact);
      at[c.path.at(-1)] = value;
    });
    assert.equal(result.ok, false, JSON.stringify(c));
    if (!result.ok)
      assert.equal(result.diagnostic.code, c.loader_code ?? c.code, JSON.stringify(result));
  }
  for (const field of ['minimum', 'maximum']) {
    const result = load((c) => {
      delete c.facts[`${prefix}:fact/maud_trust`].value_type[field];
    });
    assert.ok(!result.ok);
    assert.equal(result.diagnostic.code, 'FACT_TYPE_MISMATCH');
  }
});
