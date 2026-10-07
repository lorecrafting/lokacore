import { resolve } from '../src/commands/target.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newWorld, step, type Cartridge, type World } from '../src/index.ts';
import type { Command } from '../src/contracts.gen.ts';
import { read } from './read.ts';
import { key } from '../src/foundation/compose.ts';
import { gameView } from '../src/view/view.ts';
import { deathSequence } from '../src/mechanics/death/sequence.ts';
import { resourceRef, adjust, level } from '../src/mechanics/resource.ts';
import { apply } from '../src/runtime/apply.ts';
import { adopt, admit } from '../src/runtime/proposal.ts';
import { accepted, allocator } from '../src/runtime/decision.ts';

const cartridge = read('protocol/fixtures/missing_child_v042_hash.json').value as Cartridge;
const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never;
const ref = (w: World, kind: string, name: string) =>
  `${w.cartridge.manifest.id}@${w.cartridge.manifest.version}:${kind}/${name}`;
const room = (w: World, name: string) => w.roomIds[ref(w, 'room', name)];
const npc = (w: World, name: string) => w.entityIds[ref(w, 'npc', name)];
function command(w: World, payload: object, n = 1): Command {
  return {
    id: `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`,
    world_context_id: context,
    payload: { actor_id: w.character, ...payload },
  } as unknown as Command;
}
function run(w: World, payload: object, n = 1) {
  const next = step(w, command(w, payload, n), n);
  assert.equal(next.decision.kind, 'accepted', JSON.stringify(next.decision));
  return next.world;
}
function fresh(entry?: string) {
  let w = newWorld(
    entry ? { ...cartridge, entry: { ...cartridge.entry, key: entry as never } } : cartridge,
    context,
    [1, 2, 3, 4],
  );
  return run(w, { type: 'choose_ancestry', ancestry: 'road_born' });
}
const names = (w: World) =>
  Object.values(w.state.visited_rooms ?? {})
    .map((v) => w.rooms[v.room_id].title)
    .sort();

// Break: projection/Look discovers adjacent rooms, or accepted body entry forgets its durable visit.
test('only committed body entry adds a visited room; refused moves and rendering add none', () => {
  const initial = fresh();
  assert.deepEqual(names(initial), ['room.ferry_landing.title']);
  const before = JSON.stringify(initial.state);
  gameView(initial);
  gameView(initial);
  assert.equal(JSON.stringify(initial.state), before);
  const looked = run(initial, { type: 'look' }, 2);
  assert.deepEqual(names(looked), ['room.ferry_landing.title']);
  const refused = step(looked, command(looked, { type: 'move', direction: 'up' }, 3), 3);
  assert.equal(refused.decision.kind, 'rejected');
  assert.strictEqual(refused.world, looked);
  const moved = run(looked, { type: 'move', direction: 'north' }, 4);
  assert.deepEqual(names(moved), ['room.ferry_landing.title', 'room.well_lane.title']);
  assert.deepEqual(names(run(moved, { type: 'look' }, 5)), names(moved));
  assert.equal(
    Object.values(moved.state.visited_rooms!).every((r) => r.actor_id === moved.character),
    true,
  );
});

// Break: accepted Look records a hidden NPC or refreshes a remembered NPC from its remote live position.
test('Look observes only visible local NPCs at its committed logical time', () => {
  const initial = fresh();
  const ash = npc(initial, 'ash');
  assert.ok(ash);
  const observedKey = key({ kind: 'observation', actor_id: initial.character, npc_id: ash });
  assert.equal(initial.state.observed_npcs?.[observedKey], undefined);
  const local = {
    ...initial,
    state: {
      ...initial.state,
      containers: { ...initial.state.containers, [ash]: room(initial, 'ferry_landing') },
    },
  };
  assert.ok(gameView(local).known_npcs!.some((n) => n.id === ash));
  assert.equal(local.state.observed_npcs?.[observedKey], undefined);
  const seen = run(local, { type: 'look' }, 2);
  assert.deepEqual(seen.state.observed_npcs![observedKey], {
    actor_id: initial.character,
    npc_id: ash,
    room_id: room(initial, 'ferry_landing'),
    at: 64800,
  });
  const hidden = {
    ...seen,
    state: {
      ...seen.state,
      clock: 64801,
      containers: {
        ...seen.state.containers,
        [seen.body]: room(seen, 'well_shaft'),
        [ash]: room(seen, 'well_shaft'),
      },
    },
  };
  const looked = run(hidden, { type: 'look' }, 3);
  assert.deepEqual(
    looked.state.observed_npcs![observedKey],
    seen.state.observed_npcs![observedKey],
  );
  const remote = {
    ...seen,
    state: {
      ...seen.state,
      clock: 64801,
      containers: { ...seen.state.containers, [ash]: room(seen, 'scriptorium') },
    },
  };
  assert.deepEqual(
    run(remote, { type: 'look' }, 4).state.observed_npcs![observedKey],
    seen.state.observed_npcs![observedKey],
  );
});

// Break: the entry hook keys only off Move events and misses a real death return with no entered-room event.
test('real fatal sequence records Chapel return in the same adopted proposal', () => {
  const initial = fresh();
  const c = command(initial, { type: 'attack', target_id: npc(initial, 'ash') }, 2);
  const mint = allocator(initial, c);
  const hp = resourceRef(initial, 'hp');
  const loss = adjust(initial, initial.body, hp, -level(initial, initial.body, hp)!, {}).op;
  const dead = apply(initial, [loss]);
  assert.ok(!('fault' in dead));
  const seq = deathSequence(
    dead.world,
    c,
    { loss, owner_id: initial.character, killer_id: null, credited_character_id: null },
    mint,
  );
  const proposal = admit('death', accepted(initial, 'died', [loss, ...seq.ops], seq.events));
  const next = adopt(initial, proposal, c as never, mint, 2);
  assert.equal(next.decision.kind, 'accepted', JSON.stringify(next.decision));
  assert.deepEqual(names(next.world), ['room.chapel_nave.title', 'room.ferry_landing.title']);
});

// Break: the authored ordinary boot never becomes a second held candidate, or exact touch selects the other item.
test('both real recoverable boots retain exact ambiguous IDs and independent touch examination', () => {
  const pins = read('protocol/fixtures/missing_child_v042_ids.json');
  let w = fresh(),
    n = 2;
  const go = (...directions: string[]) => {
    for (const direction of directions) w = run(w, { type: 'move', direction }, n++);
  };
  go('north', 'west');
  w = run(w, { type: 'take', item_id: pins['item/leather_boots'] }, n++);
  go('east', 'south', 'south', 'south');
  w = run(w, { type: 'take', item_id: pins['item/boot'] }, n++);
  assert.deepEqual(resolve(w, w.character, 'boot'), {
    kind: 'ambiguous',
    candidate_ids: [pins['item/boot'], pins['item/leather_boots']].sort(),
  });
  for (const item of ['item/boot', 'item/leather_boots']) {
    const examined = step(w, command(w, { type: 'look', target_id: pins[item] }, n), n++);
    assert.equal(examined.decision.kind, 'accepted');
    if (examined.decision.kind === 'accepted') assert.equal(examined.decision.outcome, 'examined');
    assert.equal(examined.world.state.containers[pins[item]], w.body);
  }
});
