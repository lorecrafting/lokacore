import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fresh, entity, ref } from './transport_fixture.ts';
import { key } from '../src/foundation/compose.ts';
import { spokenBy } from '../src/mechanics/dialogue/selection.ts';
import { gameView } from '../src/index.ts';
import type { FactValue } from '../src/contracts.gen.ts';

const pairs = [
  ['rescued', 'prior'],
  ['rescued', 'fox'],
  ['stays', 'prior'],
  ['stays', 'fox'],
  ['lost', 'prior'],
] as const;

// Breaks: cast policy or Green variants collapse a valid child/allegiance pair into generic copy.
test('all five terminal pairs project distinct cast prompts and Green descriptions', () => {
  const initial = fresh((c) => {
    c.entry = ref('room', 'village_green');
  });
  for (const [child, allegiance] of pairs) {
    const at = (name: string) =>
      key({
        kind: 'fact',
        fact: ref('fact', name),
        scope:
          name === 'village_child_status'
            ? { kind: 'instance', world_context_id: initial.context }
            : { kind: 'player', character_id: initial.character },
      });
    const world = {
      ...initial,
      state: {
        ...initial.state,
        facts: {
          ...initial.state.facts,
          [at('village_child_status')]: child as FactValue,
          [at('chapel_allegiance')]: allegiance as FactValue,
        },
      },
    };
    const suffix = `${child}_${allegiance}`;
    for (const npc of ['elspeth', 'bram', 'maud'])
      assert.equal(
        spokenBy(world, world.character, entity(world, 'npc', npc))?.prompt,
        `dialogue.d9_${npc}_${suffix}.prompt`,
        `${npc}/${suffix}`,
      );
    assert.equal(gameView(world).place.description.key, `room.village_green.${suffix}`, suffix);
  }
});
