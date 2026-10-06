import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, newWorld, step, stepElapsed, type Cartridge } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { read } from './read.ts';
import { key } from '../src/foundation/compose.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { fact } from '../src/mechanics/position/shared.ts';
import { admission } from '../src/mechanics/combat/behavior.ts';

const pin = read('protocol/fixtures/missing_child_v029_hash.json');
const ids = read('protocol/fixtures/missing_child_v029_ids.json');
const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never;
const run = 'bbbbbbbb-0000-4000-8000-000000000001' as never;
const h1 = ids['population/fen_hounds/slot1/member'] as never;
const h2 = ids['population/fen_hounds/slot2/member'] as never;
const home = ids['room/hound_run'] as never;
const nest = ids['room/adder_nest'] as never;

function fixture(start?: number) {
  const c = structuredClone(pin.value) as Cartridge;
  if (start !== undefined) (c.calendar as { start: number }).start = start;
  const populations = Object.fromEntries(
    Object.entries(c.populations!).map(([k, plan]) => [
      k,
      {
        ...plan,
        pack: {
          flight_below_percent: 25,
          flight_fare: 0 as const,
          narration: {
            helper_joined: 'hound.pack.helper',
            enemy_fled: { east: 'hound.pack.fled_east', west: 'hound.pack.fled_west' },
            primary_changed: 'hound.pack.primary',
            pack_withdrew: 'hound.pack.withdrew',
          },
        },
      },
    ]),
  ) as unknown as Cartridge['populations'];
  const world = { ...c.world!, combat: { ...c.world!.combat!, interval: 5 } };
  const w = newWorld({ ...c, populations, world }, context, [1, 2, 3, 4]);
  return {
    ...w,
    state: {
      ...w.state,
      containers: {
        ...w.state.containers,
        [w.body]: home,
        [h1]: home,
        [h2]: home,
        ...(start === undefined && {
          [ids['population/fen_hounds/slot3/member']]: nest,
          [ids['population/fen_hounds/slot4/member']]: nest,
        }),
      },
    },
  };
}

// Breaks: admission scans only the day target or cap minus one and silently omits a sixth live helper.
test('night admission visits each of six fixed slots once', () => {
  const w = fixture(72000);
  const steps = { n: 0 };
  const members = admission(w, h2, steps)!;
  assert.equal(members.length, 6);
  assert.deepEqual(members, [...members].sort());
  assert.equal(steps.n, 6);
});

function wounded(w: ReturnType<typeof fixture>, value: number) {
  const hpKey = key({ kind: 'resource', entity_id: h2, resource: resourceRef(w, 'hp') });
  return {
    ...w,
    state: {
      ...w.state,
      resources: { ...w.state.resources, [hpKey]: { value, at: w.state.clock } },
    },
  };
}

function begun(w: ReturnType<typeof fixture>) {
  return step(
    w,
    {
      id: 'aaaaaaaa-0000-4000-8000-000000000001' as never,
      world_context_id: w.context,
      payload: { type: 'attack', actor_id: w.character, target_id: h2 },
    },
    1,
  ).world;
}

function due(w: ReturnType<typeof fixture>) {
  return stepElapsed(
    w,
    {
      id: elapsedCommandId(run, w.context, 64800, 64805) as never,
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id: run, from: 64800, until: 64805 },
    },
    2,
  );
}

function seated(w: ReturnType<typeof fixture>) {
  const position = key({
    kind: 'fact',
    fact: fact(w),
    scope: { kind: 'player', character_id: w.character },
  });
  return {
    ...w,
    state: { ...w.state, facts: { ...w.state.facts, [position]: 'sitting' as never } },
  };
}

// Breaks: pack admission selects only the attacked hound or substitutes the first template member.
test('attack H2 admits both exact co-present hounds with H2 as primary', () => {
  const w = fixture();
  const begun = step(
    w,
    {
      id: 'aaaaaaaa-0000-4000-8000-000000000001' as never,
      world_context_id: w.context,
      payload: { type: 'attack', actor_id: w.character, target_id: h2 },
    },
    1,
  );
  assert.equal(begun.decision.kind, 'accepted', JSON.stringify(begun.decision));
  const row = Object.values(begun.world.state.encounters ?? {})[0]!;
  assert.deepEqual(row.active_ids, [h1, h2].sort());
  assert.equal(row.npc_id, h2);
  assert.equal(row.next_opponent_id, h2);
  assert.equal(begun.world.state.jobs![row.job_id].due_time, 64805);
  assert.deepEqual(
    gameView(begun.world).combat?.active_opponents?.map((member) => member.id),
    [h1, h2].sort(),
  );
});

// Breaks: a hound already bound to another encounter is pulled into a second pack.
test('admission omits an already engaged helper while retaining the free target', () => {
  const w = fixture();
  const occupied = {
    ...w,
    state: {
      ...w.state,
      encounters: {
        'dddddddd-0000-4000-8000-000000000001': {
          character_id: 'dddddddd-0000-4000-8000-000000000002',
          body_id: 'dddddddd-0000-4000-8000-000000000003',
          npc_id: h1,
          room_id: home,
          job_id: 'dddddddd-0000-4000-8000-000000000004',
          status: 'open',
          round: 1,
          active_ids: [h1],
          next_opponent_id: h1,
        },
      },
    },
  } as never;
  assert.deepEqual(admission(occupied, h2, { n: 0 }), [h2]);
});

// Breaks: a helper's due round cannot be composed after exact pack admission.
test('one pack round rotates the cursor and keeps one current job', () => {
  const w = fixture();
  const begun = step(
    w,
    {
      id: 'aaaaaaaa-0000-4000-8000-000000000001' as never,
      world_context_id: w.context,
      payload: { type: 'attack', actor_id: w.character, target_id: h2 },
    },
    1,
  );
  const due = stepElapsed(
    begun.world,
    {
      id: elapsedCommandId(run, w.context, 64800, 64805) as never,
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id: run, from: 64800, until: 64805 },
    },
    2,
  );
  assert.equal(due.decision.kind, 'accepted', JSON.stringify(due.decision));
  const row = Object.values(due.world.state.encounters ?? {})[0]!;
  assert.equal(row.round, 2);
  assert.equal(row.next_opponent_id, h1);
  assert.equal(due.world.state.jobs![row.job_id].due_time, 64810);
});

// Breaks: a departed primary is still struck or keeps the attack cursor after due pruning.
test('due pruning repairs a departed primary before the player opportunity', () => {
  const w = fixture();
  const joined = begun(w);
  const departed = {
    ...joined,
    state: { ...joined.state, containers: { ...joined.state.containers, [h2]: nest } },
  };
  const result = due(departed);
  assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
  assert.equal(
    result.decision.kind === 'accepted' &&
      result.decision.events.flatMap((event) =>
        event.payload.type === 'attack_result' ? [event.payload.target_id] : [],
      )[0],
    h1,
  );
  const row = Object.values(result.world.state.encounters ?? {})[0]!;
  assert.equal(row.npc_id, h1);
  assert.deepEqual(row.active_ids, [h1]);
});

// Breaks: when every bound hound has departed before its due round, closure loses withdrawal narration.
test('an empty due roster closes once and narrates pack withdrawal', () => {
  const joined = begun(fixture());
  const departed = {
    ...joined,
    state: { ...joined.state, containers: { ...joined.state.containers, [h1]: nest, [h2]: nest } },
  };
  const result = due(departed);
  assert.equal(result.decision.kind, 'accepted');
  if (result.decision.kind !== 'accepted') return;
  assert.equal(Object.values(result.world.state.encounters ?? {})[0]!.status, 'closed');
  assert.deepEqual(
    result.decision.narration?.map((line) => line.key),
    ['hound.pack.withdrew'],
  );
});

// Breaks: Flee closes only the primary while helpers keep a pending retaliatory job.
test('player Flee closes the whole roster and cancels its sole future round', () => {
  const w = begun(fixture());
  const before = Object.values(w.state.encounters ?? {})[0]!;
  const result = step(
    w,
    {
      id: 'aaaaaaaa-0000-4000-8000-000000000002' as never,
      world_context_id: w.context,
      payload: { type: 'flee', actor_id: w.character },
    },
    2,
  );
  assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
  const row = Object.values(result.world.state.encounters ?? {})[0]!;
  assert.equal(row.status, 'closed');
  assert.deepEqual(row.active_ids, []);
  assert.equal(row.next_opponent_id, null);
  assert.equal(result.world.state.jobs![before.job_id].status, 'cancelled');
});

// Breaks: a killed selected primary gets a helper's strike in its lost opportunity or ends the pack.
test('player-first selected death skips retaliation and repairs to the surviving helper', () => {
  const w = fixture();
  const combat = w.cartridge.world!.combat!;
  const tuned = {
    ...w,
    cartridge: {
      ...w.cartridge,
      world: {
        ...w.cartridge.world!,
        combat: { ...combat, player_attack: { chance: 100, damage_min: 1, damage_max: 1 } },
      },
    },
  };
  const result = due(begun(wounded(tuned, 1)));
  assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
  assert.equal(level(result.world, w.body, resourceRef(w, 'hp')), 10);
  assert.equal(level(result.world, h2, resourceRef(w, 'hp')), 0);
  const row = Object.values(result.world.state.encounters ?? {})[0]!;
  assert.deepEqual(row.active_ids, [h1]);
  assert.equal(row.npc_id, h1);
  assert.equal(
    result.decision.kind === 'accepted' &&
      result.decision.events.filter((event) => event.payload.type === 'attack_result').length,
    1,
  );
  const corpse = result.world.state.containers[ids['population/fen_hounds/slot2/pelt']];
  assert.equal(result.world.state.created?.[corpse]?.definition.key, 'hound_corpse');
});

// Breaks: a helper strikes the revived player after lethal selected-opponent damage.
test('even-round player death closes every pack member before shrine return', () => {
  const w = fixture();
  const first = due(begun(w));
  assert.equal(first.decision.kind, 'accepted');
  const bodyHp = key({ kind: 'resource', entity_id: w.body, resource: resourceRef(w, 'hp') });
  const row = Object.values(first.world.state.encounters ?? {})[0]!;
  const attacker = row.next_opponent_id!;
  const npc = first.world.entities[attacker];
  assert.equal(npc.kind, 'npc');
  if (npc.kind !== 'npc') return;
  const controlled = {
    ...first.world,
    entities: {
      ...first.world.entities,
      [attacker]: { ...npc, attack: { chance: 100, damage_min: 1, damage_max: 1 } },
    },
    state: {
      ...first.world.state,
      resources: { ...first.world.state.resources, [bodyHp]: { value: 1, at: 64805 } },
    },
  };
  const result = stepElapsed(
    controlled,
    {
      id: elapsedCommandId(run, w.context, 64805, 64810) as never,
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id: run, from: 64805, until: 64810 },
    },
    3,
  );
  assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
  const closed = Object.values(result.world.state.encounters ?? {})[0]!;
  assert.equal(closed.status, 'closed');
  assert.deepEqual(closed.active_ids, []);
  assert.equal(result.world.state.containers[w.body], ids['room/chapel_nave']);
  assert.equal(level(result.world, w.body, resourceRef(w, 'hp')), 10);
  assert.equal(
    result.decision.kind === 'accepted' &&
      result.decision.events.filter((event) => event.payload.type === 'attack_result').length,
    1,
  );
});

// Breaks: a wounded selected hound retaliates or leaves its original pelt in the old room.
test('strictly wounded selected hound flies with its pelt before either attack', () => {
  const w = fixture();
  const result = due(seated(begun(wounded(w, 1))));
  assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
  assert.equal(result.world.state.containers[h2], nest);
  assert.equal(result.world.state.containers[ids['population/fen_hounds/slot2/pelt']], h2);
  const row = Object.values(result.world.state.encounters ?? {})[0]!;
  assert.deepEqual(row.active_ids, [h1]);
  assert.equal(row.npc_id, h1);
});

// Breaks: treating the 25% boundary as fleeing steals the selected hound's next attack.
test('HP2 of maximum8 remains and attacks at the strict 25 percent boundary', () => {
  const w = fixture();
  const result = due(seated(begun(wounded(w, 2))));
  assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
  assert.equal(result.world.state.containers[h2], home);
  assert.equal(
    result.decision.kind === 'accepted' &&
      result.decision.events.filter((event) => event.payload.type === 'attack_result').length,
    1,
  );
});

// Breaks: checking flight before the player-first hit lets an injured hound retaliate instead of leaving.
test('a player-first hit can wound the selected hound into flight before its turn', () => {
  const w = fixture();
  const combat = w.cartridge.world!.combat!;
  const tuned = {
    ...w,
    cartridge: {
      ...w.cartridge,
      world: {
        ...w.cartridge.world!,
        combat: { ...combat, player_attack: { chance: 100, damage_min: 1, damage_max: 1 } },
      },
    },
  };
  const result = due(begun(wounded(tuned, 2)));
  assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
  assert.equal(result.world.state.containers[h2], nest);
  assert.equal(
    result.decision.kind === 'accepted' &&
      result.decision.events.filter((event) => event.payload.type === 'attack_result').length,
    1,
  );
});

// Breaks: a wounded hound invents a destination through a missing area exit.
test('no legal area exit keeps the wounded hound in combat', () => {
  const w = fixture();
  const joined = seated(begun(wounded(w, 1)));
  const blocked = {
    ...joined,
    rooms: { ...joined.rooms, [home]: { ...joined.rooms[home], exits: {} } },
  };
  const result = due(blocked);
  assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
  assert.equal(result.world.state.containers[h2], home);
  const row = Object.values(result.world.state.encounters ?? {})[0]!;
  assert.deepEqual(row.active_ids, [h1, h2].sort());
});

// Breaks: same-clock population wander moves a just-fled member twice or conflicts with its custody write.
test('both real same-deadline job orders leave the fled hound and pelt at its destination', () => {
  for (const [n, combatFirst] of [
    [2, true],
    [1, false],
  ] as const) {
    const original = fixture();
    const w = wounded(
      {
        ...original,
        state: {
          ...original.state,
          clock: 68395,
          containers: {
            ...original.state.containers,
            [ids['population/fen_hounds/slot3/member']]: home,
            [ids['population/fen_hounds/slot4/member']]: home,
          },
        },
      },
      1,
    );
    const admitted = step(
      w,
      {
        id: `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}` as never,
        world_context_id: w.context,
        payload: { type: 'attack', actor_id: w.character, target_id: h2 },
      },
      n,
    );
    assert.equal(admitted.decision.kind, 'accepted');
    const encounter = Object.values(admitted.world.state.encounters ?? {})[0]!;
    const population = Object.keys(admitted.world.state.jobs ?? {}).find(
      (id) => admitted.world.state.jobs![id].job.kind === 'population',
    )!;
    assert.equal(encounter.job_id < population, combatFirst);
    const waiting = seated(admitted.world);
    const result = stepElapsed(
      waiting,
      {
        id: elapsedCommandId(run, w.context, 68395, 68400) as never,
        world_context_id: w.context,
        payload: { type: 'elapsed', actor_id: w.character, run_id: run, from: 68395, until: 68400 },
      },
      n + 1,
    );
    assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
    assert.equal(result.world.state.containers[h2], nest);
    assert.equal(result.world.state.containers[ids['population/fen_hounds/slot2/pelt']], h2);
    const slot = Object.values(result.world.state.population_slots ?? {}).find(
      (row) => row.member_id === h2,
    )!;
    assert.equal(slot.last_flight_at, 68400);
    assert.equal(
      result.decision.kind === 'accepted' &&
        result.decision.delta.ops.filter((op) => op.op === 'entity.transfer' && op.entity_id === h2)
          .length,
      1,
    );
  }
});
