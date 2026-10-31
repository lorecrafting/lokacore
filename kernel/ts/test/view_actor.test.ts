// RS-5: gameView reads the passed viewer, never the world's own character (realm seams rule 1).
// Break caught: gameView sets actor_id from world.character, or exits reads world.body.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView } from '../src/index.ts';
import { key } from '../src/foundation/compose.ts';
import { validate } from '../src/foundation/validate.ts';
import { resourceRef } from '../src/mechanics/resource.ts';
import type { World } from '../src/runtime/decision.ts';
import type { CharacterId } from '../src/contracts.gen.ts';
import { read } from './read.ts';
import { fresh, id } from './showcase_fixture.ts';

const world = fresh('5ca5e000-0000-4000-8000-0000000000a5');

test('the explicit world character sees the default view (the inn: the exits of its room file)', () => {
  const view = gameView(world, world.character);
  assert.deepEqual(view, gameView(world));
  assert.equal(view.actor_id, world.character);
  assert.equal(view.place.title.key, 'room.crossroads_inn.title');
  const room = read('cartridges/toolbox_showcase/rooms/crossroads_inn.json');
  assert.deepEqual(view.exits.map((e) => e.direction).sort(), Object.keys(room.exits).sort());
});

test('a body-less viewer sees its own id and none of the player body', () => {
  const view = gameView(world, 'char:other' as CharacterId);
  assert.equal(view.actor_id, 'char:other');
  assert.deepEqual(view.exits, []);
  assert.deepEqual(view.inventory, []);
  assert.deepEqual(view.entities, []);
  assert.deepEqual(view.journal, []);
  assert.equal(view.equipment, undefined);
  assert.equal(view.combat, undefined);
  assert.equal(view.bleeding, undefined);
});

// loka-ysbt: a seen NPC carries its hp band key and nothing else of its pool; a dead one is not
// listed. The showcase's world.bands are ready 100 / hurt 50 / dying 0; the boar (hp 0..8; the
// goblin is a population spawn) at 4 is the hurt cut, 400 >= 50*8, hand-checked. Breaks: tone
// sent as the band, or the bandOf object spread (hp numbers leak). Items and the body have no hp,
// so the guard gives them no band by type.
test('a seen NPC shows its hp band key only; a dead one is not listed', () => {
  const boar = id(world, 'npc', 'boar');
  const hp = (value: number): World => ({
    ...world,
    state: {
      ...world.state,
      containers: { ...world.state.containers, [world.body]: world.state.containers[boar]! },
      resources: {
        ...world.state.resources,
        [key({ kind: 'resource', resource: resourceRef(world, 'hp'), entity_id: boar })]: {
          value,
          at: world.state.clock,
        },
      },
    },
  });
  const seen = (v: number) => gameView(hp(v)).entities.find((e) => e.id === boar);
  assert.deepEqual(
    [8, 5, 4, 3].map((v) => seen(v)?.band),
    ['ready', 'hurt', 'hurt', 'dying'],
  );
  assert.equal(seen(0), undefined);
  const view = gameView(hp(8));
  assert.deepEqual(validate('GameView', view), []);
  assert.deepEqual(
    ['current', 'maximum', 'hp', 'tone'].filter((k) => k in seen(8)!),
    [],
  );
});
