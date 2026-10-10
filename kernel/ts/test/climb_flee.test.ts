// Toolbox row 30: a player's Flee over a climb face without the item falls (mechanics.md climb face).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { combatWorld, attack, command, room } from './combat_fixture.ts';
import { step } from '../src/index.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import type { DefinitionRef } from '../src/contracts.gen.ts';

// Breaks: Flee bypasses the climb fall, so a roped-less escape over a cliff costs no HP.
test('Flee through a climb face without its item falls and loses HP', () => {
  const w = attack(combatWorld()).world;
  const here = room(w, 'lantern_cellar');
  const ref = (name: string) =>
    ({
      cartridge_id: 'ashmere_sampler',
      cartridge_version: '0.0.9',
      kind: 'room',
      key: name,
    }) as DefinitionRef;
  const cliff = {
    ...w,
    rooms: {
      ...w.rooms,
      [here]: {
        ...w.rooms[here],
        exits: {
          west: {
            to: ref('chapel_nave'),
            climb: {
              item: { ...ref('rope'), kind: 'item' },
              damage: 3,
              fell: 'narration.fell' as never,
            },
          },
        },
      },
    },
  };
  const hp = (x: typeof w) => level(x, x.body, resourceRef(x, 'hp'));
  const r = step(cliff, command(cliff, { type: 'flee', actor_id: cliff.character }, 2), 2);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  assert.equal(r.world.state.containers[w.body], room(w, 'chapel_nave'));
  assert.equal(hp(r.world), hp(cliff)! - 3);
  assert.ok(JSON.stringify(r.decision).includes('narration.fell'));
});
