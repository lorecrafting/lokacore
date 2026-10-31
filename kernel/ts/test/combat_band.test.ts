// The opponent's hp band word in the GameView combat section (loka-y6yg.49, designer ruling C2b).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { combatWorld, attack, hp, rat, room } from './combat_fixture.ts';
import { gameView } from '../src/index.ts';
import { validate } from '../src/foundation/validate.ts';
import type { World } from '../src/runtime/decision.ts';

// The rat's hp is 0..6 under the sampler's world.bands (top row `ready`, not the engine's
// `perfect_health`). hp 3: 300 >= 50*6 is the exact many_nasty_wounds cut; hp 2 falls to the next
// cut it reaches, covered_in_blood (200 >= 30*6, 200 < 40*6).
const fighting = (value: number) => hp(attack(combatWorld()).world, rat(combatWorld()), value);
function combat(w: World) {
  const view = gameView(w);
  assert.deepEqual(validate('GameView', view), []);
  return view.combat!;
}

// Breaks: the band is missing, read from the engine table instead of world.bands, or a cut is
// compared with > instead of >= (hp 3 would read bleeding_freely).
test('one opponent shows its hp band, changing at the exact cut', () => {
  assert.equal(combat(fighting(6)).band, 'ready');
  assert.equal(combat(fighting(3)).band, 'many_nasty_wounds');
  assert.equal(combat(fighting(2)).band, 'covered_in_blood');
});

// Breaks: the band leaks a foe the player cannot see, or darkness also hides its name.
test('an unseen opponent in the dark keeps its name and has no band', () => {
  const w = fighting(3);
  const cellar = room(w, 'lantern_cellar');
  const dark = {
    ...w,
    rooms: { ...w.rooms, [cellar]: { ...w.rooms[cellar]!, dark_description: 'room.dark' } },
  };
  const view = combat(dark as World);
  assert.equal(view.name, 'npc.cellar_rat.short');
  assert.equal(view.band, undefined);
});

// loka-zvwh. Breaks: a foe with no hp of its own shows a band read from the pool (a non-regen
// pool gives it the start value, a band that never changes), unlike its entities row.
test('a foe without hp of its own has no band under a non-regen pool', () => {
  const w = fighting(3);
  const r = rat(w);
  const view = combat({
    ...w,
    entities: { ...w.entities, [r]: { ...w.entities[r]!, hp: undefined } },
  });
  assert.equal('band' in view, false);
});
