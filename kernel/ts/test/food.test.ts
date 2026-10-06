import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, step } from '../src/index.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { key } from '../src/foundation/compose.ts';
import { level } from '../src/mechanics/resource.ts';
import { hydrate } from '../src/runtime/created.ts';
import { carrying } from '../src/mechanics/containment/shared.ts';
import { transition } from '../src/mechanics/food/shared.ts';
import { LIMITS } from '../src/contracts.gen.ts';
import { read } from './read.ts';
import { fresh, entity, command, ref, prefix, onlyFood } from './food_fixture.ts';

// Breaks: Forage mints apples, chooses a noneligible apple, or Eat loses custody/capped settled MV.
test('three conserved apples share Take/Drop/Forage stock and exact Eat benefit', () => {
  let w = fresh();
  const apples = ['apple_01', 'apple_02', 'apple_03'].map((k) => entity(w, 'item', k)).sort();
  const trees = Object.keys(w.details).find((id) => w.details[id].key === 'apple_trees')!;
  const take = step(w, command(w, 1, { type: 'take', item_id: apples[1] }), 1);
  assert.equal(take.decision.kind, 'accepted');
  w = take.world;
  for (const [n, answer] of [
    [2, apples[0]],
    [3, apples[2]],
  ] as const) {
    const r = step(w, command(w, n, { type: 'harvest', target_id: trees }), n);
    assert.equal(r.decision.kind, 'accepted');
    if (r.decision.kind === 'accepted')
      assert.equal((r.decision.events[0].payload as any).item_id, answer);
    w = r.world;
  }
  const empty = step(w, command(w, 4, { type: 'harvest', target_id: trees }), 4);
  assert.deepEqual(empty.decision, { kind: 'rejected', error: { code: 'not_found' } });
  assert.equal(empty.world, w);
  w = step(w, command(w, 5, { type: 'drop', item_id: apples[1] }), 5).world;
  w = step(w, command(w, 6, { type: 'harvest', target_id: trees }), 6).world;
  const row = key({ kind: 'resource', entity_id: w.body, resource: ref('resource', 'mv') });
  w = {
    ...w,
    state: {
      ...w.state,
      clock: 600,
      resources: { ...w.state.resources, [row]: { value: 92, at: 0, rate: 18, remainder: 0 } },
    },
  };
  const eaten = step(w, command(w, 7, { type: 'eat', item_id: apples[0] }), 7);
  assert.equal(eaten.decision.kind, 'accepted');
  if (eaten.decision.kind === 'accepted') {
    assert.equal(eaten.decision.outcome, 'eaten');
    assert.equal(eaten.decision.item_id, apples[0]);
    assert.deepEqual(eaten.decision.events, []);
    assert.deepEqual(eaten.decision.narration, [{ key: 'narration.eat_apple' }]);
  }
  assert.equal(level(eaten.world, w.body, ref('resource', 'mv')), 100);
  assert.equal(eaten.world.state.containers[apples[0]], w.consumed);
  assert.equal(eaten.world.entities[apples[0]], w.entities[apples[0]]);
  assert.equal(eaten.world.state.clock, 600);
  assert.deepEqual(eaten.world.state.rng, [1, 2, 3, 4]);
  assert.equal(
    gameView(eaten.world).inventory.some((i) => i.id === apples[0]),
    false,
  );
  assert.equal(carrying(eaten.world, w.body)(apples[0]), undefined);
});

// Breaks: exact keyed policy/alias and direct ownership differ between projected offer and invocation.
test('Eat alias binds advertised item and refuses full, foreign, nested, spent and nonfood targets', () => {
  const w = fresh((c) => {
    c.actions[`${prefix}:action/bite`] = {
      key: 'bite',
      command: 'eat',
      label: 'action.eat',
      accessibility: 'action.eat',
      priority: 10,
      target: { kind: 'entity', scopes: ['inventory'] },
      input: [],
      policy: { policy_version: 1, root: { op: 'all', items: [] } },
    };
  });
  const apple = entity(w, 'item', 'apple_01'),
    nonfood = entity(w, 'item', 'tin_whistle');
  const held = step(w, command(w, 1, { type: 'take', item_id: apple }), 1).world;
  const offered = gameView(held)
    .inventory.find((i) => i.id === apple)!
    .actions.find((a) => a.action_key === 'bite')!;
  assert.equal(offered.available, true);
  assert.deepEqual(offered.target_ids, [apple]);
  const invocation = {
    invocation_id: command(w, 2, {}).id,
    actor_id: w.character,
    action_key: offered.action_key,
    target_ids: offered.target_ids!,
    input: {},
  };
  const identified = identify('food-proof', w.character, invocation as never);
  assert.ok('command_id' in identified);
  const resolved = resolve(held, identified);
  assert.ok('payload' in resolved);
  if ('payload' in resolved) {
    assert.deepEqual(resolved.payload, { type: 'eat', actor_id: w.character, item_id: apple });
    assert.equal(step(held, resolved, 2, offered.action_key).decision.kind, 'accepted');
  }
  for (const [name, id, at, expected] of [
    ['ground', apple, w.roomIds[`${prefix}:room/orchard`], 'not_owned'],
    ['nested', apple, entity(w, 'item', 'storage_chest'), 'not_owned'],
    ['foreign', apple, entity(w, 'npc', 'ada'), 'not_owned'],
    ['spent', apple, w.consumed!, 'not_owned'],
    ['nonfood', nonfood, w.body, 'invalid_target'],
    ['unknown', 'ffffffff-0000-4000-8000-000000000001', w.body, 'not_found'],
  ] as const) {
    const x = {
      ...held,
      state: { ...held.state, containers: { ...held.state.containers, [id]: at } },
    };
    assert.deepEqual(
      transition(x, { type: 'eat', actor_id: w.character, item_id: id as never }),
      { code: expected },
      name,
    );
  }
  const row = key({ kind: 'resource', entity_id: w.body, resource: ref('resource', 'mv') });
  const full = {
    ...held,
    state: {
      ...held.state,
      resources: { ...held.state.resources, [row]: { value: 100, at: 0, rate: 18, remainder: 0 } },
    },
  };
  assert.deepEqual(transition(full, { type: 'eat', actor_id: w.character, item_id: apple }), {
    code: 'invalid_state',
  });
  assert.equal(
    gameView(full)
      .inventory.find((i) => i.id === apple)!
      .actions.find((a) => a.action_key === 'bite')!.available,
    false,
  );
  assert.deepEqual(
    transition(
      held,
      { type: 'eat', actor_id: w.character, item_id: apple },
      { n: LIMITS.query_steps },
    ),
    { code: 'budget_exceeded' },
  );
  const actionRef = `${prefix}:action/bite`,
    bite = held.cartridge.actions[actionRef];
  const denied = {
    ...held,
    cartridge: {
      ...held.cartridge,
      actions: {
        ...held.cartridge.actions,
        [actionRef]: {
          ...bite,
          policy: {
            policy_version: 1 as const,
            root: { op: 'not' as const, item: { op: 'all' as const, items: [] } },
          },
        },
      },
    },
  };
  assert.equal(
    gameView(denied)
      .inventory.find((i) => i.id === apple)!
      .actions.find((a) => a.action_key === 'bite')!.available,
    false,
  );
  if ('payload' in resolved)
    assert.equal(step(denied, resolved, 3, offered.action_key).decision.kind, 'rejected');
  const hp = key({ kind: 'resource', entity_id: held.body, resource: ref('resource', 'hp') });
  const dead = {
    ...held,
    state: { ...held.state, resources: { ...held.state.resources, [hp]: { value: 0, at: 0 } } },
  };
  assert.deepEqual(transition(dead, { type: 'eat', actor_id: w.character, item_id: apple }), {
    code: 'invalid_state',
  });
  const enemy = fresh((c) => {
    c.npcs[`${prefix}:npc/cellar_rat_1`].room.key = 'orchard';
    c.world.death_credit[0].room = ref('room', 'orchard');
  });
  const stocked = step(
    enemy,
    command(enemy, 1, { type: 'take', item_id: entity(enemy, 'item', 'apple_01') }),
    1,
  ).world;
  const fighting = step(
    stocked,
    command(stocked, 2, { type: 'attack', target_id: entity(enemy, 'npc', 'cellar_rat_1') }),
    2,
  );
  assert.equal(fighting.decision.kind, 'accepted');
  assert.deepEqual(
    transition(fighting.world, {
      type: 'eat',
      actor_id: enemy.character,
      item_id: entity(enemy, 'item', 'apple_01'),
    }),
    { code: 'invalid_state' },
  );
  assert.ok(fresh(onlyFood).consumed);
});

// Breaks: terminal holder allocation shifts before existing slot holders or grows a mutable holder row.
test('independent fresh IDs include consumed custody before published population births', () => {
  const w = fresh((c) => {
      c.calendar.start = 64800;
    }),
    ids = read('protocol/fixtures/missing_child_v032_ids.json');
  const actual: Record<string, string> = {
    character: w.character,
    body: w.body,
    consumed: w.consumed!,
  };
  for (const [id, room] of Object.entries(w.rooms)) actual[`room/${room.key}`] = id;
  for (const [id, detail] of Object.entries(w.details))
    actual[`detail/${w.rooms[detail.room].key}/${detail.key}`] = id;
  for (const [id, item] of Object.entries(w.entities)) {
    const origin = w.state.created?.[id]?.origin;
    if (origin?.kind === 'spawned')
      actual[
        `population/${origin.by.key}/slot${origin.slot}/${origin.role === 'hound' ? 'member' : 'pelt'}`
      ] = id;
    else actual[`${item.kind}/${item.key}`] = id;
  }
  for (const [id, job] of Object.entries(w.state.jobs ?? {}))
    actual[job.job.kind === 'population' ? `population/${job.job.key}/job` : `job/${job.job.key}`] =
      id;
  for (const [slot, id] of Object.entries(w.slots)) actual[`slot/${slot}`] = id;
  assert.deepEqual(actual, ids);
  assert.equal(w.consumed, ids.consumed);
  assert.equal(w.state.containers[w.consumed!], undefined);
  assert.equal(
    hydrate(w, { ...w.state, containers: { ...w.state.containers, [w.consumed!]: w.body } }, true),
    undefined,
  );
  assert.equal(w.capacities[w.consumed!], undefined);
  assert.equal(w.entities[w.consumed!], undefined);
  assert.equal(w.slots.hand, ids['slot/hand']);
});

// Breaks: derived created-item metadata loses opted edibility, so an offered post-loot Eat faults.
test('created edible loot uses the same admitted terminal transfer as static food', () => {
  const w = fresh((c) => {
    c.items[`${prefix}:item/hound_pelt`].edible = {
      resource: ref('resource', 'mv'),
      amount: 6,
      label: 'action.eat',
      narration: 'narration.eat_apple',
    };
  });
  const item = Object.keys(w.state.created!).find((id) => {
    const o = w.state.created![id].origin;
    return o.kind === 'spawned' && o.role === 'pelt';
  })!;
  // Controlled direct custody represents the ordinary loot transfer after the hound dies.
  const held = {
    ...w,
    state: { ...w.state, containers: { ...w.state.containers, [item]: w.body } },
  };
  assert.equal(
    gameView(held)
      .inventory.find((i) => i.id === item)!
      .actions.find((a) => a.action_key === 'eat')!.available,
    true,
  );
  const eaten = step(held, command(held, 1, { type: 'eat', item_id: item }), 0);
  assert.equal(eaten.decision.kind, 'accepted');
  assert.equal(eaten.world.state.containers[item], w.consumed);
  assert.equal(level(eaten.world, w.body, ref('resource', 'mv')), 56);
});
