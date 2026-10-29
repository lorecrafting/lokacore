import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { read } from './read.ts';
import { bundle, prefix } from './reward_storage_fixture.ts';
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

// Breaks: the loader admits a malformed receive shape (roles, types and reserved writes are the
// compiler's: content_reward_storage_test.exs).
test('portable loader rejects a malformed reward receive', () => {
  assert.ok(load(() => {}).ok);
  for (const c of read('protocol/fixtures/reward_storage_invalid.json')) {
    if (c.code !== 'SCHEMA_VIOLATION') continue;
    const result = load((v) => {
      v.barriers[`${prefix}:barrier/reward_lid`].initial = 'open';
      const d = v.dialogues[`${prefix}:dialogue/maud_turn_in`];
      let at = d;
      for (const k of c.path.slice(0, -1)) at = at[k];
      at[c.path.at(-1)] = structuredClone(c.value);
    });
    assert.equal(result.ok, false, JSON.stringify(c));
    if (!result.ok) assert.equal(result.diagnostic.code, c.code, JSON.stringify(result));
  }
});
