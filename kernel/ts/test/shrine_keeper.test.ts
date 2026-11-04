// loka-kgd.206 (docs/system/mechanics.md death@1, Revival): the showcase revives the player at the
// Wayside Shrine, where the old keeper says one line per death (the fourth repeats), and the
// GameView carries the authored revival.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView } from '../src/index.ts';
import type { World } from '../src/runtime/decision.ts';
import { validate } from '../src/foundation/validate.ts';
import { key } from '../src/foundation/compose.ts';
import { resourceRef } from '../src/mechanics/resource.ts';
import { fight, fresh, go, id, MISS, PLAYER_FIRST, ref, seeded } from './showcase_fixture.ts';

const withHp = (w: World, entity: string, value: number): World => {
  const k = key({ kind: 'resource', entity_id: entity, resource: resourceRef(w, 'hp') });
  const row = { ...w.state.resources![k]!, value, at: w.state.clock };
  return { ...w, state: { ...w.state, resources: { ...w.state.resources, [k]: row } } };
};
const keeper = (lines: string[]) => lines.filter((l) => l.startsWith('npc.keeper.'));
const walk = (w: World, ways: string[]) => ways.reduce((at, way) => go(at, way).world, w);
const shrine = (w: World) => w.roomIds[ref('room', 'wayside_shrine')];

// Breaks: the keeper is silent, says a line twice, skips one, stops at the third, or the body
// wakes anywhere but the shrine.
test('five deaths at the boar: the keeper greets each in order, then repeats his last line', () => {
  let w = walk(fresh('5ca5e000-0000-4000-8000-0000000002a6'), ['west', 'north']);
  const said: string[][] = [];
  for (let death = 1; death <= 5; death += 1) {
    const r = fight(seeded(withHp(w, w.body, 1), MISS), 'boar');
    assert.ok(r.lines.includes('combat.player_died'), `death ${death}`);
    assert.equal(r.lines.at(-1), 'death.woke');
    assert.equal(r.world.state.containers[r.world.body], shrine(r.world));
    said.push(keeper(r.lines));
    w = walk(r.world, ['down', 'west', 'west', 'north']);
  }
  assert.deepEqual(said, [
    ['npc.keeper.revived_1'],
    ['npc.keeper.revived_2'],
    ['npc.keeper.revived_3'],
    ['npc.keeper.revived_4'],
    ['npc.keeper.revived_4'],
  ]);
});

// Breaks: the keeper's alive guard is lost, so an NPC's death also moves his tally or speaks.
test('an NPC death draws no keeper line', () => {
  const w = walk(fresh('5ca5e000-0000-4000-8000-0000000002a7'), ['west', 'north']);
  const boar = id(w, 'npc', 'boar');
  const r = fight(seeded(withHp(w, boar, 1), PLAYER_FIRST), 'boar');
  assert.ok(r.events.some((e) => e.type === 'entity_died' && e.victim_id === boar));
  assert.deepEqual(keeper(r.lines), []);
});

// Breaks: the GameView drops or reshapes the cartridge's revival, or the schema refuses it.
test('the GameView carries the authored revival', () => {
  const view = gameView(fresh('5ca5e000-0000-4000-8000-0000000002a8'));
  const lines = [1, 2, 3, 4, 5].map((n) => `death.revival.${n}`);
  assert.deepEqual({ ...view.revival }, { lines, seconds: 10 }); // loaded content has a null prototype
  assert.deepEqual(validate('GameView', view), []);
});
