import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fresh, room, entity, ref, prefix } from './water_fixture.ts';
import { hydrate } from '../src/runtime/created.ts';
import { step, stepElapsed, gameView, type World } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { key } from '../src/foundation/compose.ts';
import { acquisition } from '../src/mechanics/skills.ts';
import { fact as position } from '../src/mechanics/position/shared.ts';
import { resourceRef, level } from '../src/mechanics/resource.ts';
import { movementPlan } from '../src/mechanics/movement/sequence.ts';
import { expiry } from '../src/mechanics/water/expiry.ts';
import { allocator } from '../src/runtime/decision.ts';
import { recover } from '../src/mechanics/containment/recovery.ts';
import { LIMITS, type Command, type Key } from '../src/contracts.gen.ts';

const scoped = (w: World, fact: object) =>
  key({ kind: 'fact', fact, scope: { kind: 'player', character_id: w.character } });
function learned(w: World): World {
  return {
    ...w,
    state: {
      ...w.state,
      facts: { ...w.state.facts, [scoped(w, acquisition(ref('skill', 'swim')))]: true },
    },
  };
}
function run(w: World, p: object, n = 1, action?: Key) {
  return step(
    w,
    {
      id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p },
    } as Command,
    n,
    action,
  );
}
function green(r: ReturnType<typeof run>) {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
function until(w: World, time: number, n: number) {
  return stepElapsed(
    w,
    {
      id: elapsedCommandId('aaaaaaaa-0000-4000-8000-000000000001', w.context, w.state.clock, time),
      world_context_id: w.context,
      payload: {
        type: 'elapsed',
        actor_id: w.character,
        from: w.state.clock,
        until: time,
        run_id: 'aaaaaaaa-0000-4000-8000-000000000001',
      },
    } as Command,
    n,
  );
}
const resource = (w: World, name: string) => level(w, w.body, resourceRef(w, name));
function load(w: World, grams: number): World {
  const trunk = entity(w, 'item', 'trunk');
  return {
    ...w,
    entities: {
      ...w.entities,
      [trunk]: { ...w.entities[trunk], mass_grams: grams - 400 } as never,
    },
    state: {
      ...w.state,
      containers: {
        ...w.state.containers,
        [trunk]: w.body,
        [entity(w, 'item', 'brass_key')]: w.body,
      },
    },
  };
}

// Breaks: entry ignores acquired swim, nested load, exact MV minimum, posture or following child, or debits ordinary fare as well.
test('water exact-edge admission is atomic at learned 6000g/MV10 boundary', () => {
  const base = fresh();
  for (const w of [
    base,
    load(learned(base), 6001),
    {
      ...learned(base),
      state: {
        ...base.state,
        resources: {
          ...base.state.resources,
          [key({ kind: 'resource', resource: ref('resource', 'mv'), entity_id: base.body })]: {
            value: 9,
            at: 64800,
            rate: 18,
            remainder: 0,
          },
        },
      },
    },
    {
      ...learned(base),
      state: {
        ...learned(base).state,
        facts: { ...learned(base).state.facts, [scoped(base, position(base))]: 'sitting' as never },
      },
    },
    {
      ...learned(base),
      state: {
        ...learned(base).state,
        escorts: { [base.character]: { status: 'following' } as never },
      },
    },
  ]) {
    const before = w.state,
      view = gameView(w).exits.find((e) => e.direction === 'down')!;
    assert.equal(view.available, false);
    assert.equal(run(w, { type: 'move', direction: 'down' }).decision.kind, 'rejected');
    assert.deepEqual(w.state, before);
  }
  const w = load(learned(base), 6000),
    r = run(w, { type: 'move', direction: 'down' }),
    below = green(r);
  assert.equal(gameView(w).exits.find((e) => e.direction === 'down')!.available, true);
  assert.equal(resource(below, 'mv'), 0);
  assert.equal(below.state.water![w.character].deadline, 70800);
  assert.equal(below.state.containers[w.body], room(w, 'well_bottom'));
  assert.equal(
    Object.values(below.state.jobs!).filter(
      (j) => j.water_generation !== undefined && j.status === 'pending',
    ).length,
    1,
  );
});

// Breaks: a captured Up rechecks ordinary standing/MV/load/skill/light and strands the body, or surface/reentry lets an old job kill the new dive.
test('captured free Up survives changed eligibility and old generations cannot drown reentry', () => {
  let below = green(run(learned(fresh()), { type: 'move', direction: 'down' }));
  const saved = below.state.water![below.character],
    oldJob = below.state.jobs![saved.job_id!];
  assert.equal(gameView(below).water!.remaining, 6000);
  assert.equal(gameView(below).water!.remaining_seconds, 120);
  assert.equal(gameView(below).exits.find((e) => e.direction === 'up')!.available, true);
  below = {
    ...load(below, 13000),
    state: {
      ...load(below, 13000).state,
      facts: {
        ...below.state.facts,
        [scoped(below, acquisition(ref('skill', 'swim')))]: false,
        [scoped(below, position(below))]: 'sleeping' as never,
      },
    },
  };
  assert.equal(typeof movementPlan(below, below.character, 'up' as Key), 'object');
  const surface = green(run(below, { type: 'move', direction: 'up' }, 2));
  assert.equal(resource(surface, 'mv'), 0);
  assert.equal(surface.state.water![surface.character].deadline, null);
  assert.equal(surface.state.jobs![saved.job_id!].status, 'cancelled');
  const ready = learned(fresh());
  const next = green(
    run(
      { ...ready, state: { ...ready.state, water: surface.state.water } },
      { type: 'move', direction: 'down' },
      3,
    ),
  );
  const cmd = { id: '00000000-0000-4000-8000-000000000004' } as Command;
  const obsolete = {
    ...oldJob,
    due_time: next.state.clock,
    water_generation: oldJob.water_generation,
  };
  const simulated = {
    ...next,
    state: { ...next.state, jobs: { ...next.state.jobs, [saved.job_id!]: obsolete } },
  };
  const decided = expiry(simulated, cmd, saved.job_id!, obsolete, allocator(simulated, cmd));
  assert.equal(decided.kind, 'accepted');
  if (decided.kind === 'accepted') {
    assert.deepEqual(decided.events, []);
    assert.deepEqual(decided.delta.ops, [
      { op: 'job.complete', writer_group: 0, job_id: saved.job_id },
    ]);
  }
});

// Breaks: zero MV kills before deadline, expiry loses equality, catch-up repeats death, or corpse roots are copied/lost rather than conserved.
test('deadline 70800 drowns once with actual nested possessions and same-body Chapel return', () => {
  const start = load(learned(fresh()), 6000),
    entered = green(run(start, { type: 'move', direction: 'down' }));
  const before = green(until(entered, 70799, 2));
  assert.equal(gameView(before).water!.remaining, 1);
  assert.equal(
    green(run(before, { type: 'move', direction: 'up' }, 3)).state.containers[start.body],
    room(start, 'well_shaft'),
  );
  const r = until(entered, 70800, 2),
    dead = green(r);
  assert.equal(r.decision.kind, 'accepted');
  if (r.decision.kind !== 'accepted') return;
  const events = r.decision.events.filter((e) => e.payload.type === 'entity_died');
  assert.equal(events.length, 1);
  const p = events[0].payload;
  assert.equal(p.type, 'entity_died');
  if (p.type !== 'entity_died') return;
  assert.equal(p.cause, 'drowning');
  assert.equal(p.killer_id, null);
  assert.equal(p.credited_character_id, null);
  assert.equal(events[0].logical_time, 70800);
  assert.equal(p.victim_id, start.body);
  assert.equal(dead.body, start.body);
  assert.equal(dead.state.containers[start.body], room(start, 'chapel_nave'));
  assert.equal(resource(dead, 'hp'), 10);
  assert.equal(resource(dead, 'mv'), 100);
  assert.equal(dead.state.water![start.character].deadline, null);
  const trunk = entity(start, 'item', 'trunk'),
    torch = entity(start, 'item', 'torch');
  assert.equal(dead.state.containers[trunk], p.corpse_id);
  assert.equal(dead.state.containers[torch], trunk);
  const offer = gameView(dead).corpse_recovery![0];
  assert.equal(offer.corpse_id, p.corpse_id);
  assert.equal(offer.room_id, room(start, 'well_bottom'));
  const restored = green(run(dead, { type: 'recover_corpse', corpse_id: p.corpse_id }, 3));
  assert.equal(restored.state.containers[trunk], start.body);
  assert.equal(restored.state.containers[torch], trunk);
  assert.ok(restored.state.created![p.corpse_id]);
  assert.equal(gameView(restored).corpse_recovery, undefined);
  assert.equal(
    run(restored, { type: 'recover_corpse', corpse_id: p.corpse_id }, 4).decision.kind,
    'rejected',
  );
  assert.equal(
    Object.values(green(until(restored, 72000, 5)).state.created!).filter(
      (i) => i.origin.kind === 'death',
    ).length,
    1,
  );
});

// Breaks: recovery accepts foreign ownership, forged identity, an isle corpse, or applies voluntary load limits to forced original-root transfer.
test('Chapel recovery selects only actual owned bottom corpses and permits forced overload', () => {
  const w = load(learned(fresh()), 6000),
    dead = green(until(green(run(w, { type: 'move', direction: 'down' })), 70800, 2));
  const corpse = Object.entries(dead.state.created!).find(([, i]) => i.origin.kind === 'death')![0],
    trunk = entity(w, 'item', 'trunk');
  for (const changed of [
    {
      ...dead,
      state: {
        ...dead.state,
        created: {
          ...dead.state.created,
          [corpse]: {
            ...dead.state.created![corpse],
            origin: {
              ...dead.state.created![corpse].origin,
              owner_id: 'aaaaaaaa-0000-4000-8000-000000000001',
            },
          },
        },
      },
    },
    {
      ...dead,
      state: {
        ...dead.state,
        containers: { ...dead.state.containers, [corpse]: room(w, 'isle_hut') },
      },
    },
    { ...dead, state: { ...dead.state, created: {} } },
  ]) {
    assert.equal(gameView(changed as World).corpse_recovery, undefined);
    assert.equal(
      run(changed as World, { type: 'recover_corpse', corpse_id: corpse }, 3).decision.kind,
      'rejected',
    );
  }
  const coin = entity(w, 'item', 'old_coin');
  const carrying = {
    ...dead,
    entities: { ...dead.entities, [coin]: { ...dead.entities[coin], mass_grams: 12000 } as never },
    state: { ...dead.state, containers: { ...dead.state.containers, [coin]: dead.body } },
  };
  const recovered = green(run(carrying, { type: 'recover_corpse', corpse_id: corpse }, 3));
  assert.equal(recovered.state.containers[coin], w.body);
  assert.equal(recovered.state.containers[trunk], w.body);
});

// Breaks: malformed corpse custody or an exhausted query budget is refused with a receipt instead of faulting (audit A5).
test('Chapel recovery faults on a non-item corpse root and on query_steps exhaustion', () => {
  const w = load(learned(fresh()), 6000),
    dead = green(until(green(run(w, { type: 'move', direction: 'down' })), 70800, 2));
  const corpse = Object.entries(dead.state.created!).find(([, i]) => i.origin.kind === 'death')![0];
  const npc = Object.keys(dead.entities).find(
    (id) => id !== dead.body && dead.entities[id].kind !== 'item',
  )!;
  const malformed = {
    ...dead,
    state: { ...dead.state, containers: { ...dead.state.containers, [npc]: corpse } },
  } as World;
  const r = run(malformed, { type: 'recover_corpse', corpse_id: corpse }, 3);
  assert.deepEqual(r.decision, { kind: 'fault', code: 'precondition_failed' });
  assert.equal(r.world, malformed);
  const p = { type: 'recover_corpse', actor_id: dead.character, corpse_id: corpse } as never;
  assert.deepEqual(recover(dead, p, { n: LIMITS.query_steps }), {
    kind: 'fault',
    code: 'budget_exceeded',
  });
});

// Breaks: Pool Bottom lacks the real dark container/loot consumer, loot bypasses B4, or Take/Surface renews or debits the dive.
test('both real bottoms retain darkness, actual chest descendants and free lit-loot return', () => {
  const base = learned(
    fresh((c) => {
      c.entry = ref('room', 'black_pool');
    }),
  );
  const dark = green(run(base, { type: 'move', direction: 'down' }));
  assert.equal(dark.state.containers[base.body], room(base, 'pool_bottom'));
  assert.deepEqual(gameView(dark).entities, []);
  assert.equal(gameView(dark).exits.find((e) => e.direction === 'up')!.available, true);
  const torch = entity(base, 'item', 'torch'),
    lit = green(
      run(
        {
          ...base,
          state: { ...base.state, containers: { ...base.state.containers, [torch]: base.body } },
        },
        { type: 'ignite', item_id: torch },
      ),
    );
  let below = green(run(lit, { type: 'move', direction: 'down' }, 2));
  const chest = entity(base, 'item', 'sunken_chest'),
    ring = entity(base, 'item', 'silver_ring');
  assert.ok(gameView(below).entities.some((e) => e.id === chest));
  below = green(run(below, { type: 'take', item_id: chest }, 3));
  assert.equal(below.state.containers[ring], chest);
  below = green(run(below, { type: 'take', item_id: ring }, 4));
  assert.equal(below.state.containers[ring], base.body);
  assert.equal(below.state.water![base.character].deadline, 70800);
  assert.equal(resource(below, 'mv'), 0);
  assert.equal(
    green(run(below, { type: 'move', direction: 'up' }, 5)).state.containers[base.body],
    room(base, 'black_pool'),
  );
});

// Breaks: empty underwater corpse history rescans all custody per corpse and exhausts the Book query budget at Chapel.
test('empty corpse history stays bounded by one holder scan and creates no recovery offers', () => {
  const dead = green(
    until(green(run(learned(fresh()), { type: 'move', direction: 'down' })), 70800, 2),
  );
  const created = { ...dead.state.created },
    containers = { ...dead.state.containers };
  for (let n = 1; n <= 400; n++) {
    const id = `aaaaaaaa-1111-4111-8111-${String(n).padStart(12, '0')}` as never;
    created[id] = {
      id,
      definition: ref('item', 'player_corpse'),
      origin: {
        kind: 'death',
        victim_id: dead.body,
        owner_id: dead.character,
        event_id: `bbbbbbbb-1111-4111-8111-${String(n).padStart(12, '0')}` as never,
      },
    };
    containers[id] = room(dead, 'well_bottom');
  }
  const history = hydrate(dead, { ...dead.state, created, containers }, true);
  assert.ok(history);
  assert.equal(gameView(history).corpse_recovery, undefined);
  assert.equal(gameView(history).place.id, room(dead, 'chapel_nave'));
});

// Breaks: an unrelated loaded move alias makes the Book's narrowed move key appear usable although its captured invocation is refused.
test('water exit projection checks its exact move key despite a differently keyed allowed alias', () => {
  const w = learned(
    fresh((c) => {
      const a = {
        label: 'action.recover_corpse',
        accessibility: 'action.recover_corpse',
        command: 'move',
        target: { kind: 'none' },
        input: ['direction'],
        priority: 0,
        policy: { policy_version: 1, root: { op: 'all', items: [] } },
      };
      c.actions[`${prefix}:action/move`] = {
        ...a,
        key: 'move',
        policy: {
          policy_version: 1,
          root: { op: 'fact_compare', fact: ref('fact', 'rat_1_killed'), equals: true },
        },
      };
      c.actions[`${prefix}:action/walk`] = { ...a, key: 'walk' };
    }),
  );
  assert.equal(gameView(w).exits.find((e) => e.direction === 'down')!.available, false);
  assert.equal(
    run(w, { type: 'move', direction: 'down' }, 1, 'move' as Key).decision.kind,
    'rejected',
  );
  assert.equal(
    run(w, { type: 'move', direction: 'down' }, 2, 'walk' as Key).decision.kind,
    'accepted',
  );
});

// Breaks: only drowning clears occupancy, so an ordinary fatal encounter leaves a live water deadline after same-body return.
test('ordinary combat death below also invalidates the original water occurrence', () => {
  let w = learned(
    fresh((c) => {
      // Controlled existing producer: relocate a real rat, make player attacks miss and its first hit fatal.
      c.resources[`${prefix}:resource/hp`].start = 1;
      c.npcs[`${prefix}:npc/cellar_rat_1`].room = ref('room', 'well_bottom');
      c.npcs[`${prefix}:npc/cellar_rat_1`].attack = { chance: 100, damage_min: 1, damage_max: 1 };
      c.world.combat.player_attack.chance = 0;
      c.world.death_credit.find((d: any) => d.npc.key === 'cellar_rat_1').room = ref(
        'room',
        'well_bottom',
      );
    }),
  );
  const torch = entity(w, 'item', 'torch');
  w = green(
    run(
      { ...w, state: { ...w.state, containers: { ...w.state.containers, [torch]: w.body } } },
      { type: 'ignite', item_id: torch },
    ),
  );
  w = green(run(w, { type: 'move', direction: 'down' }, 2));
  const job = w.state.water![w.character].job_id!;
  w = green(run(w, { type: 'attack', target_id: entity(w, 'npc', 'cellar_rat_1') }, 3));
  const result = until(w, 64950, 4),
    dead = green(result);
  assert.equal(dead.state.containers[dead.body], room(dead, 'chapel_nave'));
  assert.equal(dead.state.water![dead.character].deadline, null);
  assert.equal(dead.state.jobs![job].status, 'cancelled');
  assert.equal(result.decision.kind, 'accepted');
  if (result.decision.kind === 'accepted') {
    const died = result.decision.events.find((e) => e.payload.type === 'entity_died')!;
    assert.equal(died.payload.type, 'entity_died');
    if (died.payload.type === 'entity_died') assert.equal(died.payload.cause, undefined);
  }
});
