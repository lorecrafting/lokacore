// Two exclusive terminal recipes on one detail (policy fact_compare, outcome fact.assign) over the
// ferry_sampler KAT; and the typed contract controls shared with Elixir (bell_contracts_test.exs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { step, type World } from '../src/index.ts';
import type { Command } from '../src/contracts.gen.ts';
import { value } from '../src/mechanics/fact.ts';
import { validate } from '../src/foundation/validate.ts';
import { fragment } from './fragment.ts';
import { read } from './read.ts';

// Breaks: generated TS contracts disagree with Elixir about the typed forms.
test('bell contract controls match the shared fixtures', () => {
  for (const c of read('protocol/fixtures/bell_contracts.json'))
    assert.equal(validate(c.contract, c.value).length === 0, c.valid, c.name);
});

const f = fragment('protocol/fixtures/cartridge_ferry_hash.json');
const { prefix, ref } = f;
const PLAN = ref('fact', 'search_plan');
const terminal = (key: string, plan: string) => ({
  key,
  label: 'actions.coil_rope',
  aliases: [key],
  target: { kind: 'detail', room: ref('room', 'ferry_landing'), detail: 'mooring_post' },
  priority: 10,
  policy: {
    policy_version: 1,
    root: { op: 'fact_compare', fact: PLAN, equals: 'undecided' },
  },
  outcomes: {
    success: {
      sequence: [{ op: 'fact.assign', fact: PLAN, value: plan }],
      narration: { actor: 'narration.coil_rope.actor' },
    },
  },
});
const pair = (c: any) => {
  c.recipes[`${prefix}:recipe/lead`] = terminal('lead', 'player_led');
  c.recipes[`${prefix}:recipe/stay`] = terminal('stay', 'party_led');
};

// Breaks: either terminal admits after the other has assigned the shared fact (one overwrites the
// other, or the winner repeats).
test('the first terminal wins permanently and the other refuses without a write', () => {
  for (const [won, lost, plan] of [
    ['lead', 'stay', 'player_led'],
    ['stay', 'lead', 'party_led'],
  ]) {
    let world: World = f.genesis(pair);
    let n = 0;
    const run = (action: string, expected = 'accepted') => {
      const command = {
        id: `eeeeeeee-0000-4000-8000-${String(++n).padStart(12, '0')}`,
        world_context_id: world.context,
        payload: { actor_id: world.character, type: 'perform', action },
      } as Command;
      const before = world;
      const result = step(world, command, n);
      const d = result.decision;
      assert.equal(d.kind === 'rejected' ? d.error.code : d.kind, expected, JSON.stringify(d));
      if (expected !== 'accepted') assert.equal(result.world, before);
      world = result.world;
    };
    run(won!);
    assert.equal(value(world, world.character, PLAN), plan);
    run(lost!, 'invalid_state');
    run(won!, 'invalid_state');
    assert.equal(value(world, world.character, PLAN), plan);
  }
});
