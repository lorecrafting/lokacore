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

// Breaks: required/closed reward, adjustment and Put shapes drift from the compiler's validator.
test('shared reward/storage schema controls reject malformed fields in the portable validator', () => {
  for (const c of read('protocol/fixtures/reward_storage_contracts.json'))
    assert.equal(validate(c.contract, c.value).length === 0, c.valid, c.name);
});

// Breaks: the loader omits semantic role/type/reserved-write checks.
test('portable loader rejects malformed reward roles, types and reserved writes', () => {
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

// Breaks: either transfer feature bypasses API1.10 or legacy terminal receive stops loading.
test('each transfer feature requires API1.10 without changing terminal receive', () => {
  assert.ok(load(() => {}).ok);
  for (const feature of ['receive', 'give_allowed']) {
    const change = (c: any) => {
      if (feature === 'receive') delete c.dialogues[`${prefix}:dialogue/maud_turn_in`].quest;
      else c.items[`${prefix}:item/reward_key`].give_allowed = false;
    };
    const current = load((c) => {
      c.manifest.requires.kernel_api.at_least = '1.10';
      change(c);
    });
    assert.ok(current.ok, JSON.stringify(current));
    const old = load((c) => {
      c.manifest.requires.kernel_api.at_least = '1.9';
      change(c);
    });
    assert.ok(!old.ok);
    assert.equal(old.diagnostic.code, 'KERNEL_API_RANGE_INVALID');
  }
});

// Breaks: relaxing the receive quest requirement also permits activating a quest in that choice.
test('nonterminal receive still excludes accept', () => {
  const result = load((c) => {
    c.manifest.requires.kernel_api.at_least = '1.10';
    const d = c.dialogues[`${prefix}:dialogue/maud_turn_in`];
    delete d.quest;
    d.choices.done.accept = ref('quest', 'mauds_cellar');
  });
  assert.ok(!result.ok);
  assert.equal(result.diagnostic.code, 'OUTCOME_MISMATCH');
  assert.ok(result.diagnostic.path.endsWith('.receive'));
});
