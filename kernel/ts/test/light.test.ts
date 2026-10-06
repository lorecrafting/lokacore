import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, step, type World } from '../src/index.ts';
import { fuelAt } from '../src/foundation/fuel.ts';
import { fuelView } from '../src/mechanics/light/shared.ts';
import { resolve } from '../src/commands/target.ts';
import { sight } from '../src/mechanics/movement/rule.ts';
import { fresh, entity, room, lightActionFixture } from './light_fixture.ts';
const torch = entity('torch'),
  oil = entity('lamp_oil'),
  bag = entity('satchel');
let ordinal = 0;
export function run(w: World, type: string, fields: object = {}) {
  return step(
    w,
    {
      id: `bbbbbbbb-0000-4000-8000-${String(++ordinal).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { type, actor_id: w.character, ...fields },
    } as never,
    ordinal,
  );
}
function small(): World {
  return {
    ...fresh,
    fuelSpecs: {
      ...fresh.fuelSpecs,
      [torch]: { ...fresh.fuelSpecs[torch], capacity: 10, initial: 10 },
      [oil]: { ...fresh.fuelSpecs[oil], capacity: 6, initial: 6 },
    },
    state: {
      ...fresh.state,
      clock: 100,
      resources: Object.fromEntries(
        Object.entries(fresh.state.resources ?? {}).map(([k, r]) => [k, { ...r, at: 100 }]),
      ),
      fuel: {
        [torch]: { remaining: 10, at: 100, lit: false },
        [oil]: { remaining: 6, at: 100, lit: false },
      },
      containers: {
        ...fresh.state.containers,
        [fresh.body]: room('well_shaft'),
        [torch]: fresh.body,
        [oil]: fresh.body,
        [bag]: fresh.body,
      },
    },
  };
}
const at = (w: World, clock: number) => ({ ...w, state: { ...w.state, clock } });
const accept = (r: ReturnType<typeof run>) => {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
};
// Break: Ignite/Douse resets the old interval; exhaustion overflows or silently reignites on refill.
test('settles burn intervals once and preserves exhaustion through refueling', () => {
  let w = accept(run(small(), 'ignite', { item_id: torch }));
  assert.deepEqual(fuelView(at(w, 103), torch), { remaining: 7, capacity: 10, lit: true });
  w = accept(run(at(w, 103), 'douse', { item_id: torch }));
  assert.deepEqual(w.state.fuel![torch], { remaining: 7, at: 103, lit: false });
  assert.equal(fuelView(at(w, 110), torch)!.remaining, 7);
  w = accept(run(at(w, 110), 'ignite', { item_id: torch }));
  assert.equal(fuelView(at(w, 112), torch)!.remaining, 5);
  assert.deepEqual(fuelView(at(w, 117), torch), { remaining: 0, capacity: 10, lit: false });
  assert.equal(run(at(w, 117), 'ignite', { item_id: torch }).decision.kind, 'rejected');
  w = accept(run(at(w, 117), 'douse', { item_id: torch }));
  assert.equal(run(w, 'douse', { item_id: torch }).decision.kind, 'rejected');
  w = accept(run(w, 'refuel', { item_id: torch, supply_id: oil }));
  assert.deepEqual(w.state.fuel, {
    [torch]: { remaining: 6, at: 117, lit: false },
    [oil]: { remaining: 0, at: 117, lit: false },
  });
  assert.deepEqual(
    fuelAt(
      { remaining: 9, at: 0, lit: true },
      { ...w.fuelSpecs[torch], kind: 'source', rate: 9007199254740991 } as never,
      9007199254740991,
    ),
    { remaining: 0, at: 9007199254740991, lit: false },
  );
});
// Break: a partial refill loses excess supply or settles the lit interval after adding oil.
test('refuel conserves exact supply and preserves the settled effective lit state', () => {
  for (const [remaining, expected] of [
    [2, [8, 0]],
    [7, [8, 5]],
  ] as const) {
    const start = small();
    const w = {
      ...start,
      fuelSpecs: { ...start.fuelSpecs, [torch]: { ...start.fuelSpecs[torch], capacity: 8 } },
      state: {
        ...start.state,
        fuel: { ...start.state.fuel, [torch]: { remaining, at: 100, lit: false } },
      },
    };
    const next = accept(run(w, 'refuel', { item_id: torch, supply_id: oil }));
    assert.deepEqual(
      [next.state.fuel![torch].remaining, next.state.fuel![oil].remaining],
      expected,
    );
  }
  const lit = accept(run(small(), 'ignite', { item_id: torch }));
  const refilled = accept(run(at(lit, 103), 'refuel', { item_id: torch, supply_id: oil }));
  assert.deepEqual(refilled.state.fuel, {
    [torch]: { remaining: 10, at: 103, lit: true },
    [oil]: { remaining: 3, at: 103, lit: false },
  });
});
// Break: non-owned/nested/worn oil or a full source gets consumed despite invalid custody/headroom.
test('unavailable refuel controls and forged commands refuse atomically', () => {
  const base = small();
  for (const parent of [bag, fresh.slots.light, room('well_shaft')]) {
    const w = {
      ...base,
      state: {
        ...base.state,
        containers: { ...base.state.containers, [oil]: parent },
        fuel: { ...base.state.fuel, [torch]: { remaining: 2, at: 100, lit: false } },
      },
    };
    const r = run(w, 'refuel', { item_id: torch, supply_id: oil });
    assert.equal(r.decision.kind, 'rejected');
    assert.equal(r.world, w);
    assert.ok(
      !gameView(w)
        .inventory.find((e) => e.id === torch)!
        .actions.some((a) => a.action_key === 'refuel'),
    );
  }
  assert.equal(run(base, 'refuel', { item_id: torch, supply_id: oil }).decision.kind, 'rejected');
  assert.equal(run(base, 'refuel', { item_id: torch, supply_id: bag }).decision.kind, 'rejected');
});
// Break: dark room identities/raw IDs leak, nested torches illuminate, or public egress is gated.
test('darkness shares projection/admission and never blocks the return stair', () => {
  let w = small();
  const masonry = Object.keys(w.details).find((id) => w.details[id].room === room('well_shaft'))!;
  assert.equal(gameView(w).place.description.key, 'room.well_shaft.dark');
  assert.equal(resolve(w, w.character, 'masonry').kind, 'none');
  assert.equal(run(w, 'look', { target_id: masonry }).decision.kind, 'rejected');
  assert.ok(sight(w, w.body).every((s) => !s.entities && !s.room));
  assert.equal(run(w, 'move', { direction: 'up' }).decision.kind, 'accepted');
  w = accept(run(w, 'ignite', { item_id: torch }));
  assert.equal(resolve(w, w.character, 'masonry').kind, 'unique');
  assert.equal(run(w, 'look', { target_id: masonry }).decision.kind, 'accepted');
  w = accept(run(w, 'put', { item_id: torch, container_id: bag }));
  assert.equal(gameView(w).place.description.key, 'room.well_shaft.dark');
  assert.equal(run(w, 'look', { target_id: masonry }).decision.kind, 'rejected');
  w = accept(run(at(w, 103), 'take', { item_id: torch }));
  assert.equal(fuelView(w, torch)!.remaining, 7);
  assert.equal(gameView(w).place.description.key, 'room.well_shaft.description');
  w = accept(run(w, 'wear', { item_id: torch }));
  assert.ok(
    gameView(w)
      .equipment!.find((s) => s.slot === 'light')!
      .item!.actions.some((a) => a.action_key === 'douse'),
  );
  assert.equal(run(at(w, 110), 'look', { target_id: masonry }).decision.kind, 'rejected');
});
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { stepElapsed } from '../src/index.ts';
// Break: losing the only torch hides the actual owned corpse/bag, or foreign ownership is bypassed.
test('real lethal combat leaves reachable owner-only corpse roots and nested goods in darkness', () => {
  const rat =
    fresh.entityIds[
      `${fresh.cartridge.manifest.id}@${fresh.cartridge.manifest.version}:npc/cellar_rat_1`
    ];
  const initial = {
    ...fresh,
    entities: {
      ...fresh.entities,
      [rat]: {
        ...fresh.entities[rat],
        attack: { chance: 100, damage_min: 10, damage_max: 10 },
      } as never,
    },
    state: {
      ...fresh.state,
      containers: {
        ...fresh.state.containers,
        [fresh.body]: room('well_shaft'),
        [rat]: room('well_shaft'),
        [torch]: fresh.body,
        [bag]: fresh.body,
        [oil]: bag,
      },
    },
  };
  let w = accept(run(initial, 'ignite', { item_id: torch }));
  w = accept(run(w, 'attack', { target_id: rat }));
  const from = w.state.clock,
    until = from + 150,
    run_id = '6f6f6f6f-1111-4222-8333-444444444444';
  const dead = stepElapsed(
    w,
    {
      id: elapsedCommandId(run_id, w.context, from, until),
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id, from, until },
    } as never,
    3,
  );
  assert.equal(dead.decision.kind, 'accepted', JSON.stringify(dead.decision));
  w = dead.world;
  const corpse = Object.keys(w.state.created!)[0];
  assert.equal(w.state.containers[w.body], room('chapel_nave'));
  assert.deepEqual(
    [w.state.containers[torch], w.state.containers[bag], w.state.containers[oil]],
    [corpse, corpse, bag],
  );
  for (const direction of ['south', 'south', 'south', 'south', 'down'])
    w = accept(run(w, 'move', { direction }));
  assert.equal(w.state.containers[w.body], room('well_shaft'));
  assert.equal(gameView(w).place.description.key, 'room.well_shaft.dark');
  assert.deepEqual(
    gameView(w).entities.map((e) => e.id),
    [corpse],
  );
  assert.ok(gameView(w).entities[0].contents?.some((e) => e.id === oil));
  assert.equal(run(w, 'look', { target_id: corpse }).decision.kind, 'accepted');
  const identity = w.state.created![corpse];
  const foreign = {
    ...w,
    state: {
      ...w.state,
      created: {
        ...w.state.created,
        [corpse]: {
          ...identity,
          origin: { ...identity.origin, owner_id: 'aaaaaaaa-0000-4000-8000-000000000999' },
        } as never,
      },
    },
  };
  assert.ok(!gameView(foreign).entities.some((e) => e.id === corpse));
  assert.equal(run(foreign, 'take', { item_id: torch }).decision.kind, 'rejected');
  w = accept(run(w, 'take', { item_id: bag }));
  assert.equal(w.state.containers[bag], w.body);
  assert.equal(w.state.containers[oil], bag);
  w = accept(run(w, 'take', { item_id: torch }));
  assert.equal(w.state.containers[torch], w.body);
  assert.equal(fuelView(w, torch)!.remaining, 7050);
});
import { holds } from '../src/mechanics/policy.ts';
// Break: target-present starts a new illumination budget after its caller has nearly exhausted query work.
test('illumination shares the target policy caller query budget', () => {
  const w = accept(run(small(), 'ignite', { item_id: torch }));
  const masonry = Object.keys(w.details).find((id) => w.details[id].room === room('well_shaft'))!;
  const steps = { n: 32767 };
  assert.equal(
    holds(w, w.character, { op: 'target_present' }, { target: masonry as never, steps }),
    false,
  );
  assert.ok(steps.n > 32768);
});
import { answers } from './light_fixture.ts';
// Break: adding a room/detail shifts runtime allocations while the independent release pin still names different objects.
test('successor identity pin names the actual fresh rooms, subjects, jobs and equipment holders', () => {
  const actual: Record<string, string> = { character: fresh.character, body: fresh.body };
  for (const [id, r] of Object.entries(fresh.rooms)) actual[`room/${r.key}`] = id;
  for (const [id, d] of Object.entries(fresh.details))
    actual[`detail/${fresh.rooms[d.room].key}/${d.key}`] = id;
  for (const [id, e] of Object.entries(fresh.entities)) actual[`${e.kind}/${e.key}`] = id;
  for (const [id, j] of Object.entries(fresh.state.jobs ?? {})) actual[`job/${j.job.key}`] = id;
  for (const [slot, id] of Object.entries(fresh.slots)) actual[`slot/${slot}`] = id;
  assert.deepEqual(actual, answers);
});

// Break: a physically eligible held/worn light advertises an alias rejected by its authored target/input contract.
test('light projection respects loaded keyed target and input admission before offering a source', () => {
  for (const [target, input] of [
    [{ kind: 'none' }, []],
    [{ kind: 'entity', scopes: ['room_contents'] }, []],
    [{ kind: 'entity', scopes: ['inventory'] }, ['until']],
  ] as const) {
    const base = lightActionFixture('kindle', 'ignite', target, [...input]);
    for (const holder of [base.body, base.slots.light]) {
      const w = {
        ...base,
        state: { ...base.state, containers: { ...base.state.containers, [torch]: holder } },
      };
      const view = gameView(w);
      assert.ok(!view.actions.some((a) => a.action_key === 'kindle' && a.available));
      const source =
        holder === base.body
          ? view.inventory.find((e) => e.id === torch)!
          : view.equipment!.find((e) => e.slot === 'light')!.item!;
      assert.ok(!source.actions.some((a) => a.action_key === 'kindle' && a.available));
      const command = {
        id: 'bbbbbbbb-0000-4000-8000-000000000003',
        world_context_id: w.context,
        payload: { type: 'ignite', actor_id: w.character, item_id: torch },
      };
      assert.deepEqual(step(w, command as never, 1, 'kindle' as never).decision, {
        kind: 'rejected',
        error: { code: 'unsupported_capability' },
      });
    }
  }
});
