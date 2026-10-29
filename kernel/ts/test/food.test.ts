import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, step } from '../src/index.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { key } from '../src/foundation/compose.ts';
import { id } from '../src/foundation/id_source.ts';
import { level } from '../src/mechanics/resource.ts';
import { carrying } from '../src/mechanics/containment/shared.ts';
import { transition } from '../src/mechanics/food/shared.ts';
import { LIMITS } from '../src/contracts.gen.ts';
import { fresh, entity, command, ref, prefix, onlyFood } from './food_fixture.ts';

// Breaks: Eat loses custody, mis-adds the benefit or skips the cap on settled MV (inline: mv 50, amount 6, regen 18/3600).
test('Take/Drop keeps one apple in custody and exact Eat adds the benefit, capped at the maximum', () => {
  let w = fresh();
  const apples = ['apple_01', 'apple_02', 'apple_03'].map((k) => entity(w, 'item', k)).sort();
  const inn = w.roomIds[`${prefix}:room/crossroads_inn`];
  w = step(w, command(w, 1, { type: 'take', item_id: apples[1] }), 1).world;
  assert.equal(w.state.containers[apples[1]], w.body);
  w = step(w, command(w, 2, { type: 'drop', item_id: apples[1] }), 2).world;
  assert.equal(w.state.containers[apples[1]], inn);
  w = step(w, command(w, 3, { type: 'take', item_id: apples[0] }), 3).world;
  const plain = step(w, command(w, 4, { type: 'eat', item_id: apples[0] }), 4);
  assert.equal(plain.decision.kind, 'accepted');
  assert.equal(level(plain.world, w.body, ref('resource', 'mv')), 56);
  w = step(w, command(w, 5, { type: 'take', item_id: apples[2] }), 5).world;
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
    assert.deepEqual(eaten.decision.narration, [{ key: 'narration.eat_loaf' }]);
  }
  // 92 at clock 0 settles to 95 by 600 (18 per 3600), +6 is 101, capped at the maximum 100.
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
      policy: { op: 'all', items: [] },
    };
  });
  const apple = entity(w, 'item', 'apple_01'),
    nonfood = entity(w, 'item', 'axe');
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
    ['ground', apple, w.roomIds[`${prefix}:room/crossroads_inn`], 'not_owned'],
    ['nested', apple, entity(w, 'item', 'crate'), 'not_owned'],
    ['foreign', apple, entity(w, 'npc', 'cook'), 'not_owned'],
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
          policy: { op: 'not' as const, item: { op: 'all' as const, items: [] } },
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
    c.npcs[`${prefix}:npc/boar`].room.key = 'crossroads_inn';
  });
  const stocked = step(
    enemy,
    command(enemy, 1, { type: 'take', item_id: entity(enemy, 'item', 'apple_01') }),
    1,
  ).world;
  const fighting = step(
    stocked,
    command(stocked, 2, { type: 'attack', target_id: entity(enemy, 'npc', 'boar') }),
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

// Breaks: derived created-item metadata loses opted edibility, so an offered post-loot Eat faults.
test('created edible loot uses the same admitted terminal transfer as static food', () => {
  const w = fresh((c) => {
    c.items[`${prefix}:item/feather`].edible = {
      resource: ref('resource', 'mv'),
      amount: 6,
      label: 'action.eat',
      narration: 'narration.eat_loaf',
    };
  });
  const item = Object.keys(w.state.created!).find((id) => {
    const o = w.state.created![id].origin;
    return o.kind === 'spawned' && w.entities[id].key === 'feather';
  })!;
  // Controlled direct custody represents the ordinary loot transfer after a hen dies.
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

// Breaks: the roomless consumed holder is minted before the slot holders (shifting every slot id and
// so every saved id), or it lands in containers, entities or capacities. Expected ids come from
// IdSource ordinals under the nil CommandId: consumed follows the last slot holder.
test('the consumed holder takes the ordinal after the last slot holder and is no entity', () => {
  const w = fresh();
  const NIL = '00000000-0000-0000-0000-000000000000';
  const ordinal = (x: string) => {
    for (let k = 0; k < 5000; k++) if (id(w.context, NIL, k) === x) return k;
    throw new Error(`no ordinal for ${x}`);
  };
  const last = Math.max(...Object.values(w.slots).map(ordinal));
  assert.equal(ordinal(w.consumed!), last + 1);
  for (const m of [w.state.containers, w.entities, w.capacities])
    assert.equal(w.consumed! in m, false);
});
