// RS-5: gameView reads the passed viewer, never the world's own character (realm seams rule 1).
// Break caught: gameView, placeView or exits reads world.character or world.body, not the actor.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView } from '../src/index.ts';
import type { CharacterId } from '../src/contracts.gen.ts';
import { fresh } from './showcase_fixture.ts';

const world = fresh('5ca5e000-0000-4000-8000-0000000000a5');

test('the explicit world character sees the default view (the inn: 4 exits in its room file)', () => {
  const view = gameView(world, world.character);
  assert.deepEqual(view, gameView(world));
  assert.equal(view.actor_id, world.character);
  assert.equal(view.place.title.key, 'room.crossroads_inn.title');
  assert.equal(view.exits.length, 4);
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
