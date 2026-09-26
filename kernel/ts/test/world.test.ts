// World state, look and move (R5 S1; 03 §3, §23; 04 §5; 21 §5). The world is built from the
// rooms known answer (protocol/fixtures/cartridge_rooms_hash.json). Expected ids are
// hand-computed outside the kernel: Python's hashlib over the IdSource input
// ["loka-id-v1", context, nil command id, ordinal] (numeric-profile.md), and room titles
// are the fixture's text keys.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hash } from '../src/canonical.ts';
import type { Command } from '../src/contracts.gen.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { accepted, event, rejected } from '../src/decision.ts';
import {
  decideWith,
  gameView,
  holds,
  INSTALLED,
  newWorld,
  step as kernelStep,
} from '../src/world.ts';
import { read } from './read.ts';

// Every rule call sees a deep-frozen world, so a rule that mutates it throws here (ADR-072).
const freeze = <T>(v: T): T => {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const x of Object.values(v)) freeze(x);
  }
  return v;
};
const step = (w: World, c: Command) => kernelStep(freeze(w), c);

const kat = read('protocol/fixtures/cartridge_rooms_hash.json');
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const CHARACTER = 'bd595711-ea5f-89a5-abb0-046cd349d2f9'; // ordinal 0
const BODY = '3d4829ad-9e43-81ef-bc10-66b1b267e157'; // ordinal 1
const BOATHOUSE = '1a7c3699-2844-8a55-b29f-eac079c7bf50'; // 2: rooms in ref order
const FERRY = '91fde0fc-dd14-846f-826e-245e45d16ec7'; // 3
const WELL = '953a909b-3a29-8c5c-9e3f-4105b9a47c4b'; // 4
const CMD = 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b';
const SEED = [1, 2, 3, 4];

const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`),
  INSTALLED,
);
assert.ok(loaded.ok);
const cartridge = loaded.cartridge as Cartridge;
const fresh = () => newWorld(cartridge, CONTEXT as World['context'], SEED);
const cmd = (payload: object): Command =>
  ({ id: CMD, world_context_id: CONTEXT, payload: { actor_id: CHARACTER, ...payload } }) as Command;
const move = (direction: string) => cmd({ type: 'move', direction });
const title = (w: World) => gameView(w).place.title.key;

// Breaks: ids minted from another input or order, or the body not placed in the entry room.
test('a fresh world mints IdSource ids and puts the player in the entry room', () => {
  const w = fresh();
  assert.equal(w.character, CHARACTER);
  assert.deepEqual(w.state, { clock: 0, containers: { [BODY]: FERRY }, rng: SEED });
  assert.deepEqual(w.roomIds, {
    'ashmere_rooms@0.0.1:room/boathouse': BOATHOUSE,
    'ashmere_rooms@0.0.1:room/ferry_landing': FERRY,
    'ashmere_rooms@0.0.1:room/well_lane': WELL,
  });
  assert.deepEqual(gameView(w), {
    actor_id: CHARACTER,
    place: {
      id: FERRY,
      title: { key: 'room.ferry_landing.title' },
      description: { key: 'room.ferry_landing.description' },
    },
    exits: [
      { available: true, direction: 'north' },
      { available: true, direction: 'west' },
    ],
    actions: [],
    entities: [],
    inventory: [],
    journal: [],
    time: 0,
  });
});

// Breaks: a wrong destination, a missing or wrong delta, a missing event, or state not adopted.
test('move north proposes one transfer and entity_entered_room, and commits it', () => {
  const { decision, world } = step(fresh(), move('north'));
  assert.deepEqual(decision, {
    kind: 'accepted',
    outcome: 'moved',
    delta: {
      ops: [
        {
          op: 'entity.transfer',
          writer_group: 0,
          entity_id: BODY,
          source_id: FERRY,
          destination_id: WELL,
        },
      ],
    },
    events: [
      {
        id: 'e2870386-6797-8a1b-8e1a-b2c028c16c49', // IdSource [context, command, 0], Python
        world_context_id: CONTEXT,
        scope: { kind: 'player', character_id: CHARACTER },
        actor_id: CHARACTER,
        logical_time: 0,
        position: 1,
        causation_id: CMD,
        correlation_id: CMD,
        payload: { type: 'entity_entered_room', entity_id: BODY, room_id: WELL },
      },
    ],
    effects: [],
    rng: SEED,
  });
  assert.deepEqual(world.state.containers, { [BODY]: WELL });
});

// Breaks: an exit followed in the wrong direction, or a room title from the wrong definition.
test('a scripted walk visits the expected rooms and rejects the known bad moves', () => {
  const walk: [Command, string, string][] = [
    [cmd({ type: 'look' }), 'accepted', 'room.ferry_landing.title'],
    [move('north'), 'accepted', 'room.well_lane.title'],
    [move('sideways'), 'rejected invalid_target', 'room.well_lane.title'],
    [move('north'), 'rejected not_found', 'room.well_lane.title'],
    [move('south'), 'accepted', 'room.ferry_landing.title'],
    [move('west'), 'accepted', 'room.boathouse.title'],
    [move('up'), 'rejected not_found', 'room.boathouse.title'],
    [move('east'), 'accepted', 'room.ferry_landing.title'],
  ];
  let w = fresh();
  for (const [command, kind, place] of walk) {
    const { decision, world } = step(w, command);
    const got = decision.kind === 'rejected' ? `rejected ${decision.error.code}` : decision.kind;
    assert.deepEqual([got, title(world)], [kind, place], JSON.stringify(command.payload));
    if (decision.kind === 'rejected') assert.equal(world, w); // consumes nothing (04 §5.0)
    for (const id of ['player_in_one_room', 'exits_resolve']) assert.ok(holds(id, world), id);
    w = world;
  }
});

// Breaks: look proposes a change, or advances the RNG.
test('look is accepted with an empty delta and leaves the state unchanged', () => {
  const w = fresh();
  const { decision, world } = step(w, cmd({ type: 'look' }));
  assert.deepEqual(decision, {
    kind: 'accepted',
    outcome: 'looked',
    delta: { ops: [] },
    events: [],
    effects: [],
    rng: SEED,
  });
  assert.equal(hash(world.state as never), hash(w.state as never));
});

// Breaks: a command of an uninstalled or unlocked capability, another actor, another world or
// the reserved nil CommandId (numeric profile, initial world) reaches a rule.
test('unknown capabilities and other actors are rejected before any rule', () => {
  const w = fresh();
  const take = cmd({ type: 'take', item_id: BODY });
  const unlocked = {
    ...w,
    cartridge: { ...cartridge, lock: { ...cartridge.lock, capabilities: { movement: 1 } } },
  };
  const stranger = {
    ...move('north'),
    payload: { type: 'move', actor_id: BODY, direction: 'north' },
  };
  for (const [world, command, code] of [
    [w, take, 'unsupported_capability'],
    [unlocked, cmd({ type: 'look' }), 'unsupported_capability'],
    [w, stranger, 'not_found'],
    [w, { ...move('north'), world_context_id: BODY }, 'not_found'],
    [w, { ...move('north'), id: '00000000-0000-0000-0000-000000000000' }, 'permission_denied'],
  ] as [World, Command, string][])
    assert.deepEqual(step(world, command).decision, { kind: 'rejected', error: { code } });
});

// Breaks: an invariant check that always holds.
test('the movement invariants fail on a broken world', () => {
  const w = fresh();
  const lost = { ...w, state: { ...w.state, containers: { [BODY]: CMD } } } as unknown as World;
  assert.equal(holds('player_in_one_room', lost), false);
  const rooms = {
    ...w.rooms,
    [WELL]: { ...w.rooms[WELL], exits: { up: { to: { ...cartridge.entry, key: 'attic' } } } },
  };
  assert.equal(holds('exits_resolve', { ...w, rooms } as World), false);
  assert.throws(() => holds('no_such_invariant', w));
});

// Breaks: the trace's delta digest hashes other bytes than the StateDelta's canonical form.
test('the delta digest construction matches the Python known answer', () => {
  const { value, sha256 } = read('protocol/fixtures/delta_digest.json');
  assert.equal(hash(value), sha256);
});

// Planted rules through the admission boundary (Astra A2 counterexamples 1 and 3). Breaks: the
// event-ownership check is removed, or the world a rule sees is writable.
test('a rule emitting a foreign event is rejected, and one mutating the world throws', () => {
  const w = freeze(fresh());
  const foreign = (world: World, c: Command, mint: () => string) => {
    const payload = JSON.parse(
      `{"type":"item_acquired","item_id":"${BODY}","holder_id":"${BODY}"}`,
    );
    return accepted(world, 'moved', [], [event(world, c, mint, 1, payload)]);
  };
  assert.deepEqual(decideWith(w, move('north'), 'movement', foreign as never).decision, {
    kind: 'rejected',
    error: { code: 'unsupported_capability' },
  });
  const mutating = (world: World) => {
    const { assign } = Object;
    assign(world.state, { clock: 123 });
    return rejected('invalid_target');
  };
  assert.throws(() => decideWith(w, move('north'), 'movement', mutating as never), TypeError);
  assert.equal(w.state.clock, 0);
});
