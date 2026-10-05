import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { read } from './read.ts';
import { bundle, prefix, ref } from './reward_storage_fixture.ts';
import { validate } from '../src/foundation/validate.ts';
import { encode } from '../src/foundation/canonical.ts';
import { loadCartridge, INSTALLED } from '../src/index.ts';

const load = (change: (c: any) => void, api = INSTALLED) => {
  const c = structuredClone(bundle.value);
  change(c);
  const canonical = encode(c),
    content_hash = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(JSON.stringify({ cartridge: c, content_hash })),
    api,
  );
};

// Breaks: required/closed reward, adjustment and Put shapes drift from the compiler's validator.
test('shared reward/storage schema controls reject malformed fields in the portable validator', () => {
  for (const c of read('protocol/fixtures/reward_storage_contracts.json'))
    assert.equal(validate(c.contract, c.value).length === 0, c.valid, c.name);
});

// Breaks: the loader omits semantic role/type/reserved-write checks or accepts new vocabulary on old API.
test('portable loader shares reward semantic controls and rejects older declared/installed API', () => {
  for (const c of read('protocol/fixtures/reward_storage_invalid.json')) {
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
  const old = load((c) => {
    c.manifest.requires.kernel_api.at_least = '1.6';
  });
  assert.ok(!old.ok);
  assert.equal(old.diagnostic.code, 'KERNEL_API_RANGE_INVALID');
  const installed = load(() => {}, { ...INSTALLED, kernel_api: '1.6' });
  assert.ok(!installed.ok);
  assert.equal(installed.diagnostic.code, 'KERNEL_API_UNSUPPORTED');
  for (const field of ['minimum', 'maximum']) {
    const result = load((c) => {
      delete c.facts[`${prefix}:fact/maud_trust`].value_type[field];
    });
    assert.ok(!result.ok);
    assert.equal(result.diagnostic.code, 'FACT_TYPE_MISMATCH');
  }
});

// Breaks: NPC keys are accepted without matching receive custody or with an inaccessible speaker.
test('static reward-key potential retains wrong-custody and inaccessible-speaker lockouts', () => {
  for (const variant of ['custody', 'speaker', 'room'] as const) {
    const result = load((c) => {
      if (variant === 'custody') {
        c.items[`${prefix}:item/reward_key`].location.npc = ref('npc', 'bram');
        c.npcs[`${prefix}:npc/bram`].room = ref('room', 'drowned_lantern');
      }
      if (variant === 'speaker')
        c.dialogues[`${prefix}:dialogue/maud_turn_in`].npc = ref('npc', 'bram');
      if (variant === 'room') {
        c.npcs[`${prefix}:npc/maud`].room = ref('room', 'inn_attic');
        delete c.rooms[`${prefix}:room/inn_rooms`].exits.up;
      }
    });
    assert.ok(!result.ok);
    assert.equal(result.diagnostic.code, 'BARRIER_UNREACHABLE_KEY');
  }
});
