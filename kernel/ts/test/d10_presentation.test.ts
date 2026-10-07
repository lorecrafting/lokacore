import assert from 'node:assert/strict';
import { test } from 'node:test';
import { key } from '../src/foundation/compose.ts';
import { locate } from '../src/mechanics/knowledge/shared.ts';
import { knock, decide } from '../src/mechanics/barrier/rule.ts';
import { knowledgeView } from '../src/view/knowledge.ts';
import { resolve } from '../src/commands/target.ts';
import { parse } from '../play/text.ts';
import { fresh, npc, room } from './light_fixture.ts';
import type { World } from '../src/runtime/decision.ts';
const ash = npc('aldric'),
  shaft = room('well_shaft'),
  landing = room('ferry_landing');
const seen = { actor_id: fresh.character, npc_id: ash, room_id: landing, at: 100 };
const observed = { [key({ kind: 'observation', actor_id: fresh.character, npc_id: ash })]: seen };
const dark: World = {
  ...fresh,
  state: {
    ...fresh.state,
    observed_npcs: observed,
    containers: { ...fresh.state.containers, [fresh.body]: shaft, [ash]: shaft },
  },
};

// Break: hidden co-location exposes a live NPC or ordinary targeting gains remembered candidates.
test('Where uses saved observation in darkness and remembers names only for Where', () => {
  assert.deepEqual(locate(dark, fresh.character, ash, { n: 0 }), {
    target_id: ash,
    status: 'last_seen',
    room_id: landing,
    at: 100,
  });
  assert.deepEqual(
    locate({ ...dark, state: { ...dark.state, observed_npcs: {} } }, fresh.character, ash, {
      n: 0,
    }),
    { target_id: ash, status: 'unknown' },
  );
  assert.deepEqual(resolve(dark, fresh.character, 'aldric'), { kind: 'none' });
  assert.deepEqual(resolve(dark, fresh.character, 'aldric', 'where'), {
    kind: 'unique',
    target_id: ash,
  });
  const light = {
    ...dark,
    state: {
      ...dark.state,
      containers: { ...dark.state.containers, [fresh.body]: landing, [ash]: landing },
    },
  };
  assert.deepEqual(locate(light, fresh.character, ash, { n: 0 }), {
    target_id: ash,
    status: 'here',
    room_id: landing,
  });
});

// Break: drawing discloses unvisited coordinates or links, or uses another actor's visits.
test('Map joins actor-owned visited rooms and only links with two visited endpoints', () => {
  const north = room('well_lane');
  const ref = (name: string) =>
    ({
      cartridge_id: fresh.cartridge.manifest.id,
      cartridge_version: fresh.cartridge.manifest.version,
      kind: 'room',
      key: name,
    }) as never;
  const visit = (room_id: typeof landing) => ({ actor_id: fresh.character, room_id });
  const world = {
    ...fresh,
    cartridge: {
      ...fresh.cartridge,
      map_positions: [
        { room: ref('ferry_landing'), x: 0, y: 2, z: 0 },
        { room: ref('well_lane'), x: 0, y: 1, z: 0 },
        { room: ref('well_shaft'), x: 1, y: 1, z: -1 },
      ],
    },
    state: {
      ...fresh.state,
      visited_rooms: {
        one: visit(landing),
        two: visit(north),
        other: { actor_id: 'other' as never, room_id: shaft },
      },
    },
  };
  const map = knowledgeView(world).map!;
  assert.deepEqual(
    map.rooms.map(({ id, x, y, z }) => ({ id, x, y, z })).sort((a, b) => a.y - b.y),
    [
      { id: north, x: 0, y: 1, z: 0 },
      { id: landing, x: 0, y: 2, z: 0 },
    ],
  );
  assert.deepEqual(
    map.links.filter((l) => l.from === landing),
    [{ from: landing, to: north, direction: 'north' }],
  );
  assert.ok(map.links.every((l) => !('available' in l)));
});

// Break: Knock checks a remembered speaker instead of actual presence, or opens the barrier.
test('Knock selects actual local responder and produces no writes', () => {
  const barrier = {
    cartridge_id: fresh.cartridge.manifest.id,
    cartridge_version: fresh.cartridge.manifest.version,
    kind: 'barrier',
    key: 'gate',
  } as never;
  const ref = (kind: string, name: string) =>
    ({
      cartridge_id: fresh.cartridge.manifest.id,
      cartridge_version: fresh.cartridge.manifest.version,
      kind,
      key: name,
    }) as never;
  const world = {
    ...fresh,
    rooms: {
      ...fresh.rooms,
      [landing]: {
        ...fresh.rooms[landing],
        exits: {
          ...fresh.rooms[landing].exits,
          north: {
            to: ref('room', 'well_lane'),
            barrier,
            knock: {
              npc: ref('npc', 'aldric'),
              room: ref('room', 'well_lane'),
              answered: 'answer' as never,
              unanswered: 'silence' as never,
            },
          },
        },
      },
    },
    state: {
      ...fresh.state,
      containers: { ...fresh.state.containers, [fresh.body]: landing, [ash]: room('well_lane') },
    },
  };
  assert.deepEqual(knock(world, fresh.character, 'north' as never), { text: 'answer' });
  const command = {
    id: 'command',
    world_context_id: world.context,
    payload: { type: 'knock', actor_id: fresh.character, direction: 'north' },
  } as never;
  const decision = decide(world, command, () => 'unused');
  assert.equal(decision.kind, 'accepted');
  if (decision.kind !== 'accepted') assert.fail();
  assert.deepEqual(decision.delta.ops, []);
  assert.deepEqual(decision.narration, [{ key: 'answer' }]);
  assert.deepEqual(
    knock(
      {
        ...world,
        state: { ...world.state, containers: { ...world.state.containers, [ash]: landing } },
      },
      fresh.character,
      'north' as never,
    ),
    { text: 'silence' },
  );
  assert.equal(knock(world, fresh.character, 'south' as never), 'invalid_target');
});

// Break: the terminal adapter turns Where into an item command or cannot name a physical Knock direction.
test('terminal parses Where and Knock through existing exact target and door paths', () => {
  assert.deepEqual(parse('where Ash'), { lookup: 'Ash', verb: 'where' });
  assert.deepEqual(parse('knock north'), { door: 'knock', direction: 'north' });
  assert.deepEqual(parse('knock chapel door'), { door: 'knock', words: 'chapel door' });
});
