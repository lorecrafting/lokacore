// Toolbox row 11 off the player's own move: a fleeing hound or deer never takes a face that
// declares hidden_until (mechanics.md hidden passages), nor a climb face (row 30, rope and climb),
// and the player's Flee skips a face hidden from them.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { step, stepElapsed, type World } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { escapeDirections } from '../src/mechanics/combat/flee.ts';
import { h1, h2, home, fixture, wounded, begun, due, seated, run } from './c4_pack_fixture.ts';
import { fresh } from './deer_fixture.ts';

/**
 * `world` with the exit `direction` of room `room` hidden until a false-default bool fact is true,
 * or with `climb` a climb face instead (row 30; its item is never read by an NPC).
 */
function hide<W extends World>(
  world: W,
  room: string,
  direction: 'east' | 'south',
  climb = false,
): W {
  const [id] = Object.entries(world.cartridge.facts!).find(
    ([, f]) => f.value_type.type === 'bool' && f.value_type.default === false,
  )!;
  const [, cartridge_id, cartridge_version, key] = /^(.+)@(.+):fact\/(.+)$/.exec(id)!;
  const fact = { cartridge_id, cartridge_version, kind: 'fact', key };
  const r = world.rooms[room]!;
  const exits = {
    ...r.exits,
    [direction]: {
      ...r.exits[direction]!,
      ...(climb
        ? { climb: { item: { ...fact, kind: 'item' }, damage: 1, fell: 'x' } }
        : { hidden_until: { fact, equals: true } }),
    },
  };
  return { ...world, rooms: { ...world.rooms, [room]: { ...r, exits } } } as W;
}

// Breaks: a wounded hound flees through a hidden or climb face (its only area exit), naming it in
// enemy_fled.
for (const climb of [false, true])
  test(`a wounded hound whose only area exit is ${climb ? 'a climb' : 'hidden'} stays in combat`, () => {
    const result = due(hide(seated(begun(wounded(fixture(), 1))), home, 'east', climb));
    assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
    assert.equal(result.world.state.containers[h2], home);
    const row = Object.values(result.world.state.encounters ?? {})[0]!;
    assert.deepEqual(row.active_ids, [h1, h2].sort());
  });

// Breaks: an engaged player's Flee draws a direction through a face hidden from them.
test('Flee offers only the unhidden exit', () => {
  const w = begun(fixture());
  assert.deepEqual(escapeDirections(w, w.character), ['east', 'west']);
  assert.deepEqual(escapeDirections(hide(w, home, 'east'), w.character), ['west']);
});

// Breaks: a sighted deer takes refuge through a hidden or climb face (its only area exit).
for (const climb of [false, true])
  test(`a sighted deer whose only refuge is ${climb ? 'a climb' : 'hidden'} stays put`, () => {
    let w = fresh();
    for (const [n, direction] of [
      [1, 'south'],
      [2, 'south'],
      [3, 'west'],
    ] as const)
      w = step(
        w,
        {
          id: `aaaaaaaa-0000-4000-8000-00000000000${n}` as never,
          world_context_id: w.context,
          payload: { type: 'move', actor_id: w.character, direction: direction as never },
        },
        n,
      ).world;
    const willow = w.state.containers[w.body]!;
    const deer = Object.keys(w.state.created ?? {}).find(
      (id) =>
        w.state.containers[id] === willow &&
        w.state.created![id]!.origin.kind === 'spawned' &&
        w.state.created![id]!.origin.role === 'deer',
    )!;
    assert.ok(deer);
    const hidden = hide(w, willow, 'south', climb);
    const r = stepElapsed(
      hidden,
      {
        id: elapsedCommandId(run, w.context, w.state.clock, 65100) as never,
        world_context_id: w.context,
        payload: {
          type: 'elapsed',
          actor_id: w.character,
          run_id: run,
          from: w.state.clock,
          until: 65100,
        },
      },
      5,
    );
    assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
    assert.equal(r.world.state.containers[deer], willow);
  });
