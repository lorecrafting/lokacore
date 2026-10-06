import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bundle, fresh, ref, entity, prefix } from './transport_fixture.ts';
import { gameView, INSTALLED, loadCartridge, step, stepElapsed, type World } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { key } from '../src/foundation/compose.ts';
import { runPopulation } from '../src/mechanics/population/shared.ts';

const run = 'bbbbbbbb-0000-4000-8000-000000000008' as never;
const coinRef = `${prefix}:item/old_coin`;
const START = 43200;
const initial = () =>
  fresh((c: any) => {
    c.entry = ref('room', 'village_green');
    c.calendar.start = START;
    c.items[coinRef].location = { in: 'room', room: ref('room', 'village_green') };
  });

// Breaks: a one-way authored transport corridor loads and strands a crow on its return.
test('loader refuses a crow corridor without its reciprocal return edge', () => {
  const b = bundle((c: any) => {
    delete c.rooms[`${prefix}:room/well_lane`].exits.south;
  });
  const loaded = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${b.canonical},"content_hash":"${b.sha256}"}`),
    INSTALLED,
  );
  assert.equal(loaded.ok, false);
  if (!loaded.ok) {
    assert.equal(loaded.diagnostic.code, 'SCHEMA_VIOLATION');
    assert.ok(loaded.diagnostic.path.endsWith('.scavenge'));
  }
});
function act(world: World, type: 'take' | 'drop', item_id: string, ordinal: number) {
  const result = step(
    world,
    {
      id: `aaaaaaaa-0000-4000-8000-${String(ordinal).padStart(12, '0')}` as never,
      world_context_id: world.context,
      payload: { type, actor_id: world.character, item_id: item_id as never },
    },
    ordinal,
  );
  assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
  return result.world;
}
function advance(world: World, until: number) {
  while (world.state.clock < until) {
    const due = Object.values(world.state.jobs ?? {})
      .filter((j) => j.status === 'pending')
      .map((j) => j.due_time)
      .filter((at) => at > world.state.clock);
    const to = Math.min(until, ...due);
    const result = stepElapsed(
      world,
      {
        id: elapsedCommandId(run, world.context, world.state.clock, to) as never,
        world_context_id: world.context,
        payload: {
          type: 'elapsed',
          actor_id: world.character,
          run_id: run,
          from: world.state.clock,
          until: to,
        },
      },
      100 + to,
    );
    assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
    world = result.world;
  }
  return world;
}

// Breaks: a dropped coin is copied, credited to the player, or remains with the crow after delivery.
test('one exact dropped coin travels through one crow to the open nest', () => {
  let world = initial();
  const coin = entity(world, 'item', 'old_coin');
  const nest = entity(world, 'item', 'crow_nest');
  world = act(world, 'take', coin, 1);
  world = act(world, 'drop', coin, 2);
  const bound = Object.values(world.state.crows ?? {}).filter((row) => row.phase === 'acquire');
  assert.equal(bound.length, 1);
  assert.equal(bound[0]!.item_id, coin);
  world = advance(world, START + 150);
  assert.equal(world.state.containers[coin], bound[0]!.member_id);
  assert.equal(
    gameView(world).entities.find((e) => e.id === bound[0]!.member_id)?.carrying,
    'npc.crow.carrying',
  );
  world = advance(world, START + 1500);
  assert.equal(world.state.containers[coin], nest);
  assert.equal(Object.values(world.state.containers).filter((id) => id === nest).length, 1);
  world = advance(world, START + 2400);
  assert.equal(
    world.state.containers[bound[0]!.member_id],
    world.roomIds[`${prefix}:room/village_green`],
  );
  assert.equal(
    Object.values(world.state.crows ?? {}).find((row) => row.member_id === bound[0]!.member_id)
      ?.phase,
    'idle',
  );
});

// Breaks: accepted Attack leaves the coin hidden on a fighting crow or an active transport job.
test('Attack releases carried coin and pauses the crow return', () => {
  let world = initial();
  const coin = entity(world, 'item', 'old_coin');
  world = act(world, 'take', coin, 31);
  world = act(world, 'drop', coin, 32);
  world = advance(world, START + 150);
  const carrier = Object.values(world.state.crows ?? {}).find((row) => row.phase === 'leg')!;
  const oldJob = carrier.job_id!;
  assert.equal(
    gameView(world)
      .entities.find((e) => e.id === carrier.member_id)
      ?.actions.some((a) => a.action_key === 'shoo' && a.available),
    true,
  );
  const attack = step(
    world,
    {
      id: 'aaaaaaaa-0000-4000-8000-000000000033' as never,
      world_context_id: world.context,
      payload: { type: 'attack', actor_id: world.character, target_id: carrier.member_id },
    },
    33,
  );
  assert.equal(attack.decision.kind, 'accepted', JSON.stringify(attack.decision));
  world = attack.world;
  assert.equal(world.state.containers[coin], world.roomIds[`${prefix}:room/village_green`]);
  assert.equal(world.state.jobs?.[oldJob]?.status, 'cancelled');
  assert.equal(
    gameView(world)
      .entities.find((e) => e.id === carrier.member_id)
      ?.actions.some((a) => a.action_key === 'shoo' && a.available),
    false,
  );
  assert.equal(
    Object.values(world.state.crows ?? {}).find((row) => row.member_id === carrier.member_id)
      ?.phase,
    'paused_return',
  );
  world = advance(world, START + 450);
  assert.notEqual(
    Object.values(world.state.crows ?? {}).find((row) => row.member_id === carrier.member_id)
      ?.phase,
    'paused_return',
  );
  assert.equal(world.state.containers[coin], world.roomIds[`${prefix}:room/village_green`]);
});

// Breaks: a closed original nest admits deposit, or the now empty crow still offers Shoo.
test('closed original nest causes a dry room fallback before the next leg', () => {
  let world = initial();
  const coin = entity(world, 'item', 'old_coin');
  world = act(world, 'take', coin, 41);
  world = act(world, 'drop', coin, 42);
  world = advance(world, START + 150);
  const carrier = Object.values(world.state.crows ?? {}).find((row) => row.phase === 'leg')!;
  const lid = ref('barrier', 'crow_nest_lid');
  world = {
    ...world,
    state: {
      ...world.state,
      barriers: { ...world.state.barriers, [key({ kind: 'barrier', barrier: lid })]: 'closed' },
    },
  };
  world = advance(world, START + 300);
  assert.equal(world.state.containers[coin], world.roomIds[`${prefix}:room/village_green`]);
  assert.equal(
    Object.values(world.state.crows ?? {}).find((row) => row.member_id === carrier.member_id)
      ?.phase,
    'idle',
  );
  const afterView = gameView(world).entities.find((e) => e.id === carrier.member_id);
  assert.ok(afterView);
  assert.equal(
    afterView.actions.some((a) => a.action_key === 'shoo'),
    false,
  );
});

// Breaks: a full nest accepts a ninth direct root or strands the carried coin.
test('full original nest causes a conserved room fallback', () => {
  let world = initial();
  const coin = entity(world, 'item', 'old_coin');
  const nest = entity(world, 'item', 'crow_nest');
  const filler = entity(world, 'item', 'apple_01');
  world = act(world, 'take', coin, 45);
  world = act(world, 'drop', coin, 46);
  world = advance(world, START + 150);
  world = {
    ...world,
    capacities: { ...world.capacities, [nest]: 1 },
    state: { ...world.state, containers: { ...world.state.containers, [filler]: nest } },
  };
  world = advance(world, START + 300);
  assert.equal(world.state.containers[coin], world.roomIds[`${prefix}:room/village_green`]);
  assert.equal(world.state.containers[filler], nest);
});

// Breaks: ordinary wander moves a crow on the boundary where its return job reached home.
test('a same-time return home suppresses the ordinary wander for that member', () => {
  let world = initial();
  const coin = entity(world, 'item', 'old_coin');
  world = act(world, 'take', coin, 51);
  world = advance(world, START + 1200);
  world = act(world, 'drop', coin, 52);
  const member = Object.values(world.state.crows ?? {}).find(
    (row) => row.phase === 'acquire',
  )!.member_id;
  world = advance(world, START + 3450);
  const origin = world.state.created?.[member]?.origin;
  assert.equal(origin?.kind, 'spawned');
  if (origin?.kind !== 'spawned') return;
  const control = world.state.population_plans?.[key(origin.by)]!;
  const popJob = world.state.jobs?.[control.job_id]!;
  world = advance(world, START + 3600);
  assert.equal(world.state.containers[member], world.roomIds[`${prefix}:room/village_green`]);
  assert.equal(
    Object.values(world.state.crows ?? {}).find((row) => row.member_id === member)?.phase,
    'idle',
  );
  const crowFirst = {
    ...world,
    state: {
      ...world.state,
      population_plans: { ...world.state.population_plans, [key(origin.by)]: control },
      jobs: { ...world.state.jobs, [control.job_id]: popJob },
    },
  };
  const population = runPopulation(
    crowFirst,
    { id: 'aaaaaaaa-0000-4000-8000-000000000053' as never },
    control.job_id,
    popJob,
    () => 'aaaaaaaa-0000-4000-8000-000000000054' as never,
  );
  assert.equal(population.kind, 'accepted');
  if (population.kind === 'accepted')
    assert.equal(
      population.delta.ops.some((op) => op.op === 'entity.transfer' && op.entity_id === member),
      false,
    );
});

// Breaks: a stale acquisition after Take suppresses an otherwise due ordinary wander.
test('same-time stale acquire permits the ordinary crow wander', () => {
  let world = initial();
  const coin = entity(world, 'item', 'old_coin');
  world = act(world, 'take', coin, 61);
  world = advance(world, START + 3450);
  world = act(world, 'drop', coin, 62);
  const row = Object.values(world.state.crows ?? {}).find((r) => r.phase === 'acquire')!;
  const origin = world.state.created?.[row.member_id]?.origin;
  assert.equal(origin?.kind, 'spawned');
  if (origin?.kind !== 'spawned') return;
  const control = world.state.population_plans?.[key(origin.by)]!;
  const popJob = world.state.jobs?.[control.job_id]!;
  const oldJob = row.job_id!;
  world = act(world, 'take', coin, 63);
  world = advance(world, START + 3600);
  assert.equal(world.state.jobs?.[oldJob]?.status, 'completed');
  const crowFirst = {
    ...world,
    state: {
      ...world.state,
      containers: {
        ...world.state.containers,
        [row.member_id]: world.roomIds[`${prefix}:room/village_green`],
      },
      population_plans: { ...world.state.population_plans, [key(origin.by)]: control },
      jobs: { ...world.state.jobs, [control.job_id]: popJob },
    },
  };
  const population = runPopulation(
    crowFirst,
    { id: 'aaaaaaaa-0000-4000-8000-000000000064' as never },
    control.job_id,
    popJob,
    () => 'aaaaaaaa-0000-4000-8000-000000000065' as never,
  );
  assert.equal(population.kind, 'accepted');
  if (population.kind === 'accepted')
    assert.equal(
      population.delta.ops.some(
        (op) =>
          op.op === 'entity.transfer' &&
          op.entity_id === row.member_id &&
          op.destination_id === world.roomIds[`${prefix}:room/well_lane`],
      ),
      true,
    );
});

// Breaks: a job claiming return can execute against a still carrying leg occurrence.
test('crow job phase must match the current occurrence before moving custody', () => {
  let world = initial();
  const coin = entity(world, 'item', 'old_coin');
  world = act(world, 'take', coin, 71);
  world = act(world, 'drop', coin, 72);
  world = advance(world, START + 150);
  const row = Object.values(world.state.crows ?? {}).find((r) => r.phase === 'leg')!;
  const job = world.state.jobs?.[row.job_id!]!;
  world = {
    ...world,
    state: {
      ...world.state,
      jobs: { ...world.state.jobs, [row.job_id!]: { ...job, crow_phase: 'return' } },
    },
  };
  const result = stepElapsed(
    world,
    {
      id: elapsedCommandId(run, world.context, world.state.clock, START + 300) as never,
      world_context_id: world.context,
      payload: {
        type: 'elapsed',
        actor_id: world.character,
        run_id: run,
        from: world.state.clock,
        until: START + 300,
      },
    },
    173,
  );
  assert.equal(result.decision.kind, 'fault');
  assert.equal(result.world.state.containers[coin], row.member_id);
});

// Breaks: a stale first Drop job steals a coin that was Taken and dropped again under a new cause.
test('Take before the due acquisition cancels the old intent', () => {
  let world = initial();
  const coin = entity(world, 'item', 'old_coin');
  world = act(world, 'take', coin, 11);
  world = act(world, 'drop', coin, 12);
  const old = Object.values(world.state.crows ?? {}).find((row) => row.phase === 'acquire')!;
  world = act(world, 'take', coin, 13);
  assert.equal(
    Object.values(world.state.crows ?? {}).find((row) => row.member_id === old.member_id)?.phase,
    'idle',
  );
  world = advance(world, START + 150);
  assert.equal(world.state.containers[coin], world.body);
});

// Breaks: Shoo duplicates custody, leaves an active carrier job, or permits a second Shoo.
test('Shoo releases the exact carried coin and cancels its pending transport leg', () => {
  let world = initial();
  const coin = entity(world, 'item', 'old_coin');
  world = act(world, 'take', coin, 21);
  world = act(world, 'drop', coin, 22);
  world = advance(world, START + 150);
  const carrier = Object.values(world.state.crows ?? {}).find((row) => row.phase === 'leg')!;
  const oldJob = carrier.job_id!;
  const shoo = step(
    world,
    {
      id: 'aaaaaaaa-0000-4000-8000-000000000023' as never,
      world_context_id: world.context,
      payload: { type: 'shoo', actor_id: world.character, crow_id: carrier.member_id },
    },
    23,
  );
  assert.equal(shoo.decision.kind, 'accepted', JSON.stringify(shoo.decision));
  world = shoo.world;
  assert.equal(world.state.containers[coin], world.roomIds[`${prefix}:room/village_green`]);
  assert.equal(world.state.jobs?.[oldJob]?.status, 'cancelled');
  assert.equal(
    Object.values(world.state.crows ?? {}).find((row) => row.member_id === carrier.member_id)
      ?.phase,
    'idle',
  );
  const again = step(
    world,
    {
      id: 'aaaaaaaa-0000-4000-8000-000000000024' as never,
      world_context_id: world.context,
      payload: { type: 'shoo', actor_id: world.character, crow_id: carrier.member_id },
    },
    24,
  );
  assert.equal(again.decision.kind, 'rejected');
});

// Breaks: one crow returning reserves the coin globally and blocks another eligible Green crow.
test('a second Green crow may bind a later Drop while the first returns', () => {
  let world = initial();
  const coin = entity(world, 'item', 'old_coin');
  world = act(world, 'take', coin, 81);
  world = act(world, 'drop', coin, 82);
  world = advance(world, START + 300);
  const first = Object.values(world.state.crows ?? {}).find((r) => r.phase === 'leg')!;
  assert.equal(world.state.containers[first.member_id], world.roomIds[`${prefix}:room/well_lane`]);
  const move = (w: World, direction: string, ordinal: number) => {
    const result = step(
      w,
      {
        id: `aaaaaaaa-0000-4000-8000-${String(ordinal).padStart(12, '0')}` as never,
        world_context_id: w.context,
        payload: { type: 'move', actor_id: w.character, direction: direction as never },
      },
      ordinal,
    );
    assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
    return result.world;
  };
  world = move(world, 'south', 83);
  const shoo = step(
    world,
    {
      id: 'aaaaaaaa-0000-4000-8000-000000000084' as never,
      world_context_id: world.context,
      payload: { type: 'shoo', actor_id: world.character, crow_id: first.member_id },
    },
    84,
  );
  assert.equal(shoo.decision.kind, 'accepted', JSON.stringify(shoo.decision));
  world = act(shoo.world, 'take', coin, 85);
  world = move(world, 'north', 86);
  world = act(world, 'drop', coin, 87);
  const rows = Object.values(world.state.crows ?? {});
  assert.equal(rows.find((r) => r.member_id === first.member_id)?.phase, 'return');
  const second = rows.find((r) => r.phase === 'acquire');
  assert.ok(second);
  assert.notEqual(second.member_id, first.member_id);
  assert.equal(second.item_id, coin);
});
