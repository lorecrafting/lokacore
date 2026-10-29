import assert from 'node:assert/strict';
import { test } from 'node:test';
import { step, type World } from '../src/index.ts';
import type { Command } from '../src/contracts.gen.ts';
import { fragment } from './fragment.ts';
import { key } from '../src/foundation/compose.ts';
import { gameView } from '../src/view/view.ts';
import { deathSequence } from '../src/mechanics/death/sequence.ts';
import { resourceRef, adjust, level } from '../src/mechanics/resource.ts';
import { apply } from '../src/runtime/apply.ts';
import { adopt, admit } from '../src/runtime/proposal.ts';
import { accepted, allocator } from '../src/runtime/decision.ts';
import { hydrate } from '../src/runtime/created.ts';
import { validate } from '../src/foundation/validate.ts';
import { resolve } from '../src/commands/target.ts';

// Showcase, entered at the Drill Yard (no up exit) at 18:00; the death shrine is the Crossroads Inn.
const f = fragment('protocol/fixtures/toolbox_showcase_hash.json');
const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never;
const id = (kind: string, name: string) => `${f.prefix}:${kind}/${name}`;
const room = (w: World, name: string) => w.roomIds[id('room', name)];
const npc = (w: World, name: string) => w.entityIds[id('npc', name)];
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
const fresh = () =>
  f.genesis((c) => {
    c.entry = f.ref('room', 'drill_yard');
    c.calendar.start = 64800;
  });
const names = (w: World) =>
  Object.values(w.state.visited_rooms ?? {})
    .map((v) => w.rooms[v.room_id].name)
    .sort();

// Break: projection/Look discovers adjacent rooms, or accepted body entry forgets its durable visit.
test('only committed body entry adds a visited room; refused moves and rendering add none', () => {
  const initial = fresh();
  assert.deepEqual(names(initial), ['room.drill_yard.title']);
  const before = JSON.stringify(initial.state);
  gameView(initial);
  gameView(initial);
  assert.equal(JSON.stringify(initial.state), before);
  const looked = run(initial, { type: 'look' }, 2);
  assert.deepEqual(names(looked), ['room.drill_yard.title']);
  const refused = step(looked, command(looked, { type: 'move', direction: 'up' }, 3), 3);
  assert.equal(refused.decision.kind, 'rejected');
  assert.strictEqual(refused.world, looked);
  const moved = run(looked, { type: 'move', direction: 'north' }, 4);
  assert.deepEqual(names(moved), ['room.boar_run.title', 'room.drill_yard.title']);
  assert.deepEqual(names(run(moved, { type: 'look' }, 5)), names(moved));
  assert.equal(
    Object.values(moved.state.visited_rooms!).every((r) => r.actor_id === moved.character),
    true,
  );
});

// Break: accepted Look records a hidden NPC or refreshes a remembered NPC from its remote live position.
test('Look observes only visible local NPCs at its committed logical time', () => {
  const initial = fresh();
  const hob = npc(initial, 'hob');
  assert.ok(hob);
  const observedKey = key({ kind: 'observation', actor_id: initial.character, npc_id: hob });
  assert.equal(initial.state.observed_npcs?.[observedKey], undefined);
  const local = {
    ...initial,
    state: {
      ...initial.state,
      containers: { ...initial.state.containers, [hob]: room(initial, 'drill_yard') },
    },
  };
  assert.ok(gameView(local).known_npcs!.some((n) => n.id === hob));
  assert.equal(local.state.observed_npcs?.[observedKey], undefined);
  const seen = run(local, { type: 'look' }, 2);
  assert.deepEqual(seen.state.observed_npcs![observedKey], {
    actor_id: initial.character,
    npc_id: hob,
    room_id: room(initial, 'drill_yard'),
    at: 64800,
  });
  const hidden = {
    ...seen,
    state: {
      ...seen.state,
      clock: 64801,
      containers: {
        ...seen.state.containers,
        [seen.body]: room(seen, 'crypt'),
        [hob]: room(seen, 'crypt'),
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
      containers: { ...seen.state.containers, [hob]: room(seen, 'forge_stall') },
    },
  };
  assert.deepEqual(
    run(remote, { type: 'look' }, 4).state.observed_npcs![observedKey],
    seen.state.observed_npcs![observedKey],
  );
});

// Break: the entry hook keys only off Move events and misses a real death return with no entered-room event.
test('real fatal sequence records shrine return in the same adopted proposal', () => {
  const initial = fresh();
  const c = command(initial, { type: 'attack', target_id: npc(initial, 'hob') }, 2);
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
  assert.deepEqual(names(next.world), ['room.crossroads_inn.title', 'room.drill_yard.title']);
});

// Break: Where lists a dead NPC (pass-1 UF3), or the living filter also drops a 1 HP one; typed
// `where boar` still finds the dead boar and answers last seen with no name (loka-y6yg.53).
test('known_npcs and typed Where keep a remembered NPC at 1 HP and drops it at 0 HP, also after reopen', () => {
  const initial = fresh();
  const boar = npc(initial, 'boar');
  const hp = resourceRef(initial, 'hp');
  const at = (left: number) => {
    const set = adjust(initial, boar, hp, left - level(initial, boar, hp)!, {}).op;
    const r = apply(initial, [set]);
    assert.ok(!('fault' in r));
    const observed_npcs = {
      [key({ kind: 'observation', actor_id: initial.character, npc_id: boar })]: {
        actor_id: initial.character,
        npc_id: boar,
        room_id: room(initial, 'drill_yard'),
        at: 64800,
      },
    };
    return { ...r.world, state: { ...r.world.state, observed_npcs } } as World;
  };
  for (const [left, listed] of [
    [1, true],
    [0, false],
  ] as const) {
    const w0 = at(left);
    for (const w of [w0, hydrate(fresh(), JSON.parse(JSON.stringify(w0.state)), true)!]) {
      const view = gameView(w);
      assert.deepEqual(validate('GameView', view), []);
      assert.equal(
        view.known_npcs!.some((n) => n.id === boar),
        listed,
        `hp ${left}`,
      );
      assert.deepEqual(
        resolve(w, w.character, 'boar', 'where'),
        listed ? { kind: 'unique', target_id: boar } : { kind: 'none' },
      );
    }
  }
});
