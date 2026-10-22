import assert from 'node:assert/strict';
import { test } from 'node:test';
import { genesis, ref, room, START } from './bell_fixture.ts';
import { step, stepElapsed, type World } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { apply } from '../src/runtime/apply.ts';
import { allocator } from '../src/runtime/decision.ts';
import { key } from '../src/foundation/compose.ts';
import { bellCue } from '../src/mechanics/bell/cue.ts';
import { engaged } from '../src/mechanics/combat/shared.ts';
import { suppress } from '../src/mechanics/population/shared.ts';
import { deathSequence } from '../src/mechanics/death/sequence.ts';
import { adjust, level, resourceRef } from '../src/mechanics/resource.ts';
import type { Command, EntityId } from '../src/contracts.gen.ts';

function ready(start = START): World {
  return genesis((c) => (c.calendar.start = start));
}

function run(world: World, payload: object, n: number) {
  return step(
    world,
    {
      id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
      world_context_id: world.context,
      payload: { actor_id: world.character, ...payload },
    } as Command,
    n,
  );
}

function advance(world: World, until: number) {
  const run_id = 'bbbbbbbb-0000-4000-8000-000000000099';
  while (world.state.clock < until) {
    const due = Object.values(world.state.jobs ?? {})
      .filter((j) => j.status === 'pending')
      .map((j) => j.due_time)
      .filter((at) => at > world.state.clock);
    const next = Math.min(until, ...due);
    const result = stepElapsed(
      world,
      {
        id: elapsedCommandId(run_id, world.context, world.state.clock, next),
        world_context_id: world.context,
        payload: {
          type: 'elapsed',
          actor_id: world.character,
          run_id,
          from: world.state.clock,
          until: next,
        },
      } as Command,
      2,
    );
    assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
    world = result.world;
  }
  return world;
}

// Breaks: Ring mutates goblin custody or fails to bind one 172800-second resume job to its bell event.
test('accepted bell preserves goblins and schedules one cause-bound suppression deadline', () => {
  const base = ready();
  assert.equal(base.state.containers[base.body], room(base, 'drill_yard'));
  const before = Object.values(base.state.population_slots ?? {}).filter(
    (s) => s.member_id !== null,
  ).length;
  const result = run(base, { type: 'perform', action: 'ring_bell' }, 1);
  assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
  const control = result.world.state.population_plans![key(ref('population', 'goblins'))]!;
  assert.deepEqual([control.suppression?.generation, control.suppression?.ends_at], [1, 237600]);
  assert.equal(result.world.state.jobs?.[control.suppression!.job_id!]?.due_time, 237600);
  assert.equal(
    Object.values(result.world.state.population_slots ?? {}).filter((s) => s.member_id !== null)
      .length,
    before,
  );
  assert.ok(
    result.decision.events.some(
      (e) =>
        e.id === control.suppression?.cause_event_id &&
        e.payload.type === 'fact_changed' &&
        e.payload.fact.key === 'bell_rung',
    ),
  );
});

// From start 0, slot 1's goblin dead, the bell rung at 64800 (deadline 237600).
function rung(): World {
  const base = ready(0);
  const [goblin] = Object.entries(base.state.created ?? {}).find(
    ([, row]) =>
      row.origin.kind === 'spawned' &&
      row.origin.by.key === 'goblins' &&
      row.origin.role === 'hound' &&
      row.origin.slot === 1,
  )!;
  const member = goblin as EntityId;
  const hp = resourceRef(base, 'hp');
  const loss = adjust(base, member, hp, -level(base, member, hp)!, {}).op;
  const command = {
    id: '00000000-0000-4000-8000-000000000091' as Command['id'],
    world_context_id: base.context,
    payload: { type: 'look', actor_id: base.character },
  } as const satisfies Command;
  const injured = apply(base, [loss]);
  assert.ok('world' in injured);
  const death = deathSequence(
    injured.world,
    command,
    { loss, owner_id: null, killer_id: null, credited_character_id: null },
    allocator(base, command),
  );
  const buried = apply(injured.world, death.ops);
  assert.ok('world' in buried);
  return run(advance(buried.world, 64800), { type: 'perform', action: 'ring_bell' }, 1).world;
}
const generation = (world: World) =>
  world.state.population_slots![
    key({ kind: 'population_slot', plan: ref('population', 'goblins'), slot: 1 })
  ]!.generation;

// Breaks: a population tick replaces a dead goblin during suppression, or the exact deadline leaves suppression active.
test('population ticks stay quiet until the exact two-day deadline', () => {
  let world = rung();
  world = advance(world, 72000);
  assert.equal(generation(world), 1);
  world = advance(world, 172800);
  assert.equal(generation(world), 1);
  world = advance(world, 237599);
  const atDeadline = world.state.population_plans![key(ref('population', 'goblins'))]!;
  assert.equal(atDeadline.suppression?.ends_at, 237600);
  assert.equal(world.state.jobs?.[atDeadline.job_id]?.due_time, 237600);
  world = advance(world, 237600);
  assert.equal(
    world.state.population_plans![key(ref('population', 'goblins'))]!.suppression?.ends_at,
    null,
  );
  assert.equal(generation(world), 2);
  assert.equal(
    Object.values(world.state.jobs ?? {}).filter(
      (j) => j.status === 'pending' && j.job.key === 'goblins',
    ).length,
    1,
  );
});

// Breaks (loka-dto9): the plan job whose crossed sub-step reaches the deadline and the resume job
// write plan control in two writer groups, so one advance across the deadline faults
// conflicting_write; job by job the deadline resumes once (generation 2, suppression over).
test('one advance across the bell deadline resumes the plan as job-by-job play does', () => {
  const r = once(rung(), 241200);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  assert.deepEqual(resumed(r.world), [null, 2]);
});

// Breaks (loka-dto9): pairing only a plan job due by the deadline (b.due_time <= a.due_time), so a
// plan job due after the deadline but inside the advance writes plan control in its own group and
// one advance faults conflicting_write; job by job the deadline resumes once.
test('a plan job due after the deadline pairs with the resume job in one advance', () => {
  for (const late of [1800, 3599, 3600]) {
    const world = structuredClone(advance(rung(), 237000));
    const plan = world.state.population_plans![key(ref('population', 'goblins'))]!;
    (world.state.jobs![plan.job_id] as { due_time: number }).due_time = 237600 + late;
    assert.deepEqual(resumed(advance(world, 241200)), [null, 2]);
    const r = once(world, 241200);
    assert.equal(r.decision.kind, 'accepted', `${late}: ${JSON.stringify(r.decision)}`);
    assert.deepEqual(resumed(r.world), [null, 2]);
  }
});

// One elapsed run to `until`, and a world's goblins suppression end and slot 1 generation.
function once(world: World, until: number) {
  const run_id = 'bbbbbbbb-0000-4000-8000-000000000098';
  return stepElapsed(
    world,
    {
      id: elapsedCommandId(run_id, world.context, world.state.clock, until),
      world_context_id: world.context,
      payload: {
        type: 'elapsed',
        actor_id: world.character,
        run_id,
        from: world.state.clock,
        until,
      },
    } as Command,
    3,
  );
}
const resumed = (world: World) => [
  world.state.population_plans![key(ref('population', 'goblins'))]!.suppression?.ends_at,
  generation(world),
];

// Breaks: a cause-bound suppression leaves a scheduled goblin round open or deletes its member.
test('suppression closes an open goblin encounter without reward or deleting the member', () => {
  const base = ready();
  const bell = run(base, { type: 'perform', action: 'ring_bell' }, 1);
  assert.equal(bell.decision.kind, 'accepted');
  if (bell.decision.kind !== 'accepted') return;
  const cause = bell.decision.events.find(
    (e) => e.payload.type === 'fact_changed' && e.payload.fact.key === 'bell_rung',
  )!;
  const [goblin] = Object.entries(base.state.created ?? {}).find(
    ([, row]) =>
      row.origin.kind === 'spawned' &&
      row.origin.by.key === 'goblins' &&
      row.origin.role === 'hound' &&
      row.origin.slot === 1,
  )!;
  const transferred = apply(base, [
    {
      op: 'entity.transfer',
      writer_group: 0,
      entity_id: goblin as EntityId,
      source_id: base.state.containers[goblin],
      destination_id: room(base, 'drill_yard'),
    },
  ]);
  assert.ok('world' in transferred);
  const attack = run(transferred.world, { type: 'attack', target_id: goblin }, 2);
  assert.equal(attack.decision.kind, 'accepted');
  const fight = engaged(attack.world, attack.world.body)!;
  assert.equal(fight.row.status, 'open');
  const command = {
    id: '00000000-0000-4000-8000-000000000092' as Command['id'],
    world_context_id: attack.world.context,
    payload: { type: 'look', actor_id: attack.world.character },
  } as const satisfies Command;
  const ops = suppress(
    attack.world,
    attack.world.character,
    ref('population', 'goblins'),
    172800,
    cause,
    1,
    allocator(attack.world, command),
  );
  const closed = apply(attack.world, ops);
  assert.ok('world' in closed);
  assert.equal(closed.world.state.encounters![fight.id]?.status, 'closed');
  assert.equal(closed.world.state.jobs![fight.row.job_id]?.status, 'cancelled');
  assert.equal(
    closed.world.state.population_slots![
      key({ kind: 'population_slot', plan: ref('population', 'goblins'), slot: 1 })
    ]!.member_id,
    goblin,
  );
  assert.deepEqual(closed.world.state.created, attack.world.state.created);
  assert.deepEqual(closed.world.state.facts, attack.world.state.facts);
});

// Breaks: projection treats all rooms as audible or reconstructs a new cue from later fact state.
test('one accepted bell event projects only within the declared bell area', () => {
  const result = run(ready(), { type: 'perform', action: 'ring_bell' }, 1);
  assert.equal(result.decision.kind, 'accepted');
  if (result.decision.kind !== 'accepted') return;
  const event = result.decision.events.find(
    (e) => e.payload.type === 'fact_changed' && e.payload.fact.key === 'bell_rung',
  )!;
  const command = event.causation_id as unknown as Command['id'];
  const observer = result.world.character;
  const projected = (place: string) =>
    bellCue(result.world, event, command, observer, room(result.world, place));
  assert.equal(result.world.cartridge.world!.bell_cue!.rooms.length, 2);
  assert.deepEqual(projected('drill_yard'), {
    source_event_id: event.id,
    command_id: command,
    actor_id: observer,
    observer_id: observer,
    room_id: room(result.world, 'drill_yard'),
    logical_time: 64800,
    key: 'narration.bell_cue',
  });
  assert.ok(projected('goblin_pit'));
  assert.equal(projected('crossroads_inn'), undefined);
  assert.equal(
    bellCue(
      result.world,
      event,
      'aaaaaaaa-0000-4000-8000-000000000999' as Command['id'],
      observer,
      room(result.world, 'drill_yard'),
    ),
    undefined,
  );
});

// Breaks: an old plan occurrence can refill goblins after its control has advanced.
test('stale population occurrence completes without changing the suppressed plan', () => {
  const rung = run(ready(), { type: 'perform', action: 'ring_bell' }, 1).world;
  const before = Object.values(rung.state.population_slots ?? {}).filter((s) => s.member_id).length;
  const stale_id = '99999999-9999-4999-8999-999999999999';
  const stale: World = {
    ...rung,
    state: {
      ...rung.state,
      jobs: {
        ...rung.state.jobs,
        [stale_id]: { job: ref('population', 'goblins'), due_time: 65000, status: 'pending' },
      },
    },
  };
  const after = advance(stale, 65000);
  assert.equal(after.state.jobs?.[stale_id]?.status, 'completed');
  assert.equal(
    Object.values(after.state.population_slots ?? {}).filter((s) => s.member_id).length,
    before,
  );
  assert.equal(
    after.state.population_plans![key(ref('population', 'goblins'))].suppression?.ends_at,
    237600,
  );
});

// Breaks: an ordinary successor silently drops the bell suppression while rotating its job ID.
test('population successor cannot rewrite suppression', () => {
  const world = run(ready(), { type: 'perform', action: 'ring_bell' }, 1).world;
  const plan = ref('population', 'goblins');
  const control = world.state.population_plans![key(ref('population', 'goblins'))];
  const changed = apply(world, [
    {
      op: 'population.control',
      writer_group: 0,
      plan,
      expected: control,
      value: {
        ...control,
        job_id: '99999999-9999-4999-8999-999999999999' as typeof control.job_id,
        suppression: undefined,
      },
    },
  ]);
  assert.equal('fault' in changed && changed.fault.code, 'precondition_failed');
});
