import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fresh, ref, room } from './transport_fixture.ts';
import { step, stepElapsed, type World } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { apply } from '../src/runtime/apply.ts';
import { allocator } from '../src/runtime/decision.ts';
import { activation } from '../src/mechanics/quest/lifecycle.ts';
import { key } from '../src/foundation/compose.ts';
import { bellCue } from '../src/mechanics/bell/cue.ts';
import { deathSequence } from '../src/mechanics/death/sequence.ts';
import { adjust, level, resourceRef } from '../src/mechanics/resource.ts';
import type { Command, EntityId, FactValue } from '../src/contracts.gen.ts';

function ready(start = 64800): World {
  const base = fresh((c) => {
    c.entry = ref('room', 'belfry');
    c.calendar.start = start;
  });
  const command = {
    id: '00000000-0000-4000-8000-000000000090' as Command['id'],
    world_context_id: base.context,
    payload: { type: 'look', actor_id: base.character },
  } as const satisfies Command;
  const mint = allocator(base, command);
  const search = activation(mint, base.character, ref('quest', 'missing_child'));
  const bell = activation(mint, base.character, ref('quest', 'bell_of_ashmere'));
  const started = apply(base, [...search.ops, ...bell.ops]);
  assert.ok('world' in started);
  return {
    ...started.world,
    state: {
      ...started.world.state,
      facts: {
        ...started.world.state.facts,
        [key({
          kind: 'fact',
          fact: ref('fact', 'fen_tracks_found'),
          scope: { kind: 'player', character_id: base.character },
        })]: true as FactValue,
      },
    },
  };
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

// Breaks: Ring mutates hound custody or fails to bind one 172800-second resume job to its bell event.
test('accepted bell preserves hounds and schedules one cause-bound suppression deadline', () => {
  const base = ready();
  assert.equal(base.state.containers[base.body], room(base, 'belfry'));
  const before = Object.values(base.state.population_slots ?? {}).filter(
    (s) => s.member_id !== null,
  ).length;
  const result = run(base, { type: 'perform', action: 'ring_bell' }, 1);
  assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
  const control = result.world.state.population_plans![key(ref('population', 'fen_hounds'))]!;
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
        e.payload.fact.key === 'chapel_bell_rung',
    ),
  );
});

// Breaks: a population tick replaces a dead hound during suppression, or the exact deadline leaves suppression active.
test('population ticks stay quiet until the exact two-day deadline', () => {
  const base = ready(0);
  const [hound] = Object.entries(base.state.created ?? {}).find(
    ([, row]) =>
      row.origin.kind === 'spawned' && row.origin.role === 'hound' && row.origin.slot === 1,
  )!;
  const member = hound as EntityId;
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
  let world = run(advance(buried.world, 64800), { type: 'perform', action: 'ring_bell' }, 1).world;
  const generation = () =>
    world.state.population_slots![
      key({ kind: 'population_slot', plan: ref('population', 'fen_hounds'), slot: 1 })
    ]!.generation;
  world = advance(world, 72000);
  assert.equal(generation(), 1);
  world = advance(world, 172800);
  assert.equal(generation(), 1);
  world = advance(world, 237599);
  const atDeadline = world.state.population_plans![key(ref('population', 'fen_hounds'))]!;
  assert.equal(atDeadline.suppression?.ends_at, 237600);
  assert.equal(world.state.jobs?.[atDeadline.job_id]?.due_time, 237600);
  world = advance(world, 237600);
  assert.equal(
    world.state.population_plans![key(ref('population', 'fen_hounds'))]!.suppression?.ends_at,
    null,
  );
  assert.equal(generation(), 2);
  assert.equal(
    Object.values(world.state.jobs ?? {}).filter(
      (j) => j.status === 'pending' && j.job.key === 'fen_hounds',
    ).length,
    1,
  );
});

// Breaks: projection treats all rooms as audible or reconstructs a new cue from later fact state.
test('one accepted bell event projects only within the declared Ashmere and public Priory area', () => {
  const result = run(ready(), { type: 'perform', action: 'ring_bell' }, 1);
  assert.equal(result.decision.kind, 'accepted');
  if (result.decision.kind !== 'accepted') return;
  const event = result.decision.events.find(
    (e) => e.payload.type === 'fact_changed' && e.payload.fact.key === 'chapel_bell_rung',
  )!;
  const command = event.causation_id as unknown as Command['id'];
  const observer = result.world.character;
  const projected = (place: string) =>
    bellCue(result.world, event, command, observer, room(result.world, place));
  assert.equal(result.world.cartridge.world!.bell_cue!.rooms.length, 35);
  assert.deepEqual(projected('belfry'), {
    source_event_id: event.id,
    command_id: command,
    actor_id: observer,
    observer_id: observer,
    room_id: room(result.world, 'belfry'),
    logical_time: 64800,
    key: 'narration.bell_cue',
  });
  assert.ok(projected('village_green'));
  assert.ok(projected('prior_study'));
  assert.equal(projected('reed_bank'), undefined);
  assert.equal(projected('isle_shrine'), undefined);
  assert.equal(
    bellCue(
      result.world,
      event,
      'aaaaaaaa-0000-4000-8000-000000000999' as Command['id'],
      observer,
      room(result.world, 'belfry'),
    ),
    undefined,
  );
});

// Breaks: an old plan occurrence can refill hounds after its control has advanced.
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
        [stale_id]: { job: ref('population', 'fen_hounds'), due_time: 65000, status: 'pending' },
      },
    },
  };
  const after = advance(stale, 65000);
  assert.equal(after.state.jobs?.[stale_id]?.status, 'completed');
  assert.equal(
    Object.values(after.state.population_slots ?? {}).filter((s) => s.member_id).length,
    before,
  );
  assert.equal(Object.values(after.state.population_plans ?? {})[0].suppression?.ends_at, 237600);
});

// Breaks: an ordinary successor silently drops the bell suppression while rotating its job ID.
test('population successor cannot rewrite suppression', () => {
  const world = run(ready(), { type: 'perform', action: 'ring_bell' }, 1).world;
  const plan = ref('population', 'fen_hounds');
  const control = Object.values(world.state.population_plans ?? {})[0];
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
