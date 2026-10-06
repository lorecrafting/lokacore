import assert from 'node:assert/strict';
import { test } from 'node:test';
import { step, stepElapsed } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { key } from '../src/foundation/compose.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import {
  ids,
  run,
  h1,
  h2,
  home,
  nest,
  fixture,
  wounded,
  begun,
  due,
  seated,
} from './c4_pack_fixture.ts';

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

// Breaks: an even-round selected helper flies before attacking and steals the player's remaining opportunity.
test('even-round helper flight still gives the player one attack on the healthy primary', () => {
  const w = fixture();
  const first = due(begun(w));
  assert.equal(first.decision.kind, 'accepted');
  const hpKey = key({ kind: 'resource', entity_id: h1, resource: resourceRef(w, 'hp') });
  const primaryHp = key({ kind: 'resource', entity_id: h2, resource: resourceRef(w, 'hp') });
  const combat = first.world.cartridge.world!.combat!;
  const controlled = {
    ...first.world,
    cartridge: {
      ...first.world.cartridge,
      world: {
        ...first.world.cartridge.world!,
        combat: { ...combat, player_attack: { chance: 100, damage_min: 1, damage_max: 1 } },
      },
    },
    state: {
      ...first.world.state,
      resources: {
        ...first.world.state.resources,
        [hpKey]: { value: 1, at: 64805 },
        [primaryHp]: { value: 7, at: 64805 },
      },
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
  assert.deepEqual(
    result.decision.kind === 'accepted' &&
      result.decision.events.flatMap((event) =>
        event.payload.type === 'attack_result'
          ? [[event.payload.attacker_id, event.payload.target_id]]
          : [],
      ),
    [[w.body, h2]],
  );
  assert.equal(result.world.state.containers[h1], nest);
  assert.equal(level(result.world, h2, resourceRef(w, 'hp')), 6);
  const row = Object.values(result.world.state.encounters ?? {})[0]!;
  assert.deepEqual(row.active_ids, [h2]);
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
