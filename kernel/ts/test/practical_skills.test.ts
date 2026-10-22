import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, step, type World } from '../src/index.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { practicalWorld, learned, id, patch, pool } from './practical_skills_fixture.ts';
const ores = ['01', '02', '03'].map((i) => id('item', `ore_${i}`)).sort();
const selected = ores.slice(0, 2); // careful takes the two lowest EntityIds
const smith = id('npc', 'smith');
const run = (w: World, payload: object, key?: string) =>
  step(
    w,
    {
      id: 'bbbbbbbb-0000-4000-8000-000000000001',
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    1,
    key as never,
  );
const gather = (w: World) =>
  run(w, { type: 'harvest', target_id: patch, method: 'careful' }, 'mine_carefully');
/** The body holds the 2000 g pickaxe and a stick of `grams`; the ceiling is 5000 g, an ore 1000 g. */
function burden(w: World, grams: number): World {
  const [item, pickaxe] = [id('item', 'stick'), id('item', 'pickaxe')];
  return {
    ...w,
    entities: { ...w.entities, [item]: { ...w.entities[item], mass_grams: grams } as never },
    state: { ...w.state, containers: { ...w.state.containers, [item]: w.body, [pickaxe]: w.body } },
  };
}
// Breaks: an aliased careful offer loses literal input/command binding, picks authored order, or transfers only one of two items.
test('loaded careful alias resolves literal input and transfers the two lowest finite IDs', () => {
  const w = burden(learned(practicalWorld(), 'mining'), 1000); // 2000 + 1000 + 2 x 1000 = 5000
  const view = gameView(w);
  const a = view
    .notices!.find((n) => n.id === patch)!
    .actions!.find((a) => a.action_key === 'mine_carefully')!;
  assert.deepEqual(
    [a.available, a.command, a.input, a.target_ids],
    [true, 'harvest', ['method'], [patch]],
  );
  const i = identify('test', w.character, {
    invocation_id: 'dddddddd-0000-4000-8000-000000000001',
    actor_id: w.character,
    action_key: a.action_key,
    target_ids: a.target_ids!,
    input: { method: 'careful' },
  } as never);
  assert.ok('command_id' in i);
  const command = resolve(w, i as never);
  assert.deepEqual((command as any).payload, {
    type: 'harvest',
    actor_id: w.character,
    target_id: patch,
    method: 'careful',
  });
  const result = step(w, command as never, 1, a.action_key);
  assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
  if (result.decision.kind !== 'accepted') return;
  assert.deepEqual(
    result.decision.delta.ops.map((o: any) => [
      o.entity_id,
      o.source_id,
      o.destination_id,
      o.writer_group,
    ]),
    selected.map((i) => [i, w.state.containers[w.body], w.body, 0]), // the entry room, the ores' authored room
  );
  assert.deepEqual(
    result.decision.events.map((e: any) => e.payload),
    selected.map((i) => ({ type: 'item_acquired', item_id: i, holder_id: w.body })),
  );
  assert.equal(gameView(result.world).notices!.find((n) => n.id === patch)!.remaining, 1);
  assert.deepEqual(
    selected.map((i) => result.world.state.containers[i]),
    [w.body, w.body],
  );
  assert.equal(
    run(w, { type: 'harvest', target_id: patch, method: 'careful' }, 'harvest').decision.kind,
    'rejected',
  );
});
// Breaks: eligibility ignores INT/MV/acquisition, stock count, or checks each incoming item against the same original load.
test('careful refuses atomically at each independent boundary while ordinary stock-one Harvest remains legal', () => {
  const good = burden(learned(practicalWorld(), 'mining'), 0);
  const lowStock = {
    ...good,
    state: {
      ...good.state,
      containers: { ...good.state.containers, [ores[0]]: smith, [ores[2]]: smith }, // stock 1 < count 2
    },
  };
  for (const w of [
    burden(practicalWorld(), 0),
    burden(learned(practicalWorld(9), 'mining'), 0),
    burden(learned(practicalWorld(10, 3, 4), 'mining'), 0),
    burden(good, 1001),
    lowStock,
  ]) {
    const r = gather(w);
    assert.equal(r.decision.kind, 'rejected', JSON.stringify(r.decision));
    assert.equal(r.world, w);
    assert.equal(
      gameView(w)
        .notices!.find((n) => n.id === patch)!
        .actions!.find((a) => a.action_key === 'mine_carefully')!.available,
      false,
    );
  }
  assert.equal(run(lowStock, { type: 'harvest', target_id: patch }).decision.kind, 'accepted');
  assert.equal(
    run(burden(good, 1001), { type: 'harvest', target_id: patch }).decision.kind, // 4001 g
    'accepted',
  );
});
// Breaks: quote display differs from execution, ignores current qualification, alters Sell, or accepts either direction of stale price.
test('one current quote applies every floor and conserves a 10p Buy at 9p', () => {
  const w = learned(practicalWorld(10, 20), 'haggle');
  const shelf = gameView(w).entities.find((e) => e.id === smith)!.shop!;
  // buys 10/3/1 at 9/10, floor, minimum 1; sells untouched.
  assert.deepEqual(
    shelf.map((o) => o.buy.price),
    [9, 2, 1],
  );
  assert.deepEqual(
    shelf.map((o) => o.sell.price),
    [4, 1, 1],
  );
  const item = id('item', 'lamp');
  const buy = (v: World, quoted_price: number) =>
    run(v, { type: 'buy', provider_id: smith, item_id: item, quoted_price });
  const b = buy(w, 9);
  assert.equal(b.decision.kind, 'accepted', JSON.stringify(b.decision));
  assert.deepEqual(
    [
      b.world.state.resources![pool(w, 'pennies')].value,
      b.world.state.resources![pool(w, 'pennies', smith)].value,
    ],
    [11, 29],
  );
  assert.equal(b.world.state.containers[item], w.body);
  const tired = {
    ...w,
    state: {
      ...w.state,
      resources: {
        ...w.state.resources,
        [pool(w, 'mv')]: { value: 4, at: 0 }, // an unspent pool is unmaterialized
      },
    },
  };
  assert.equal(gameView(tired).entities.find((e) => e.id === smith)!.shop![0].buy.price, 10);
  for (const [v, price] of [
    [tired, 9],
    [w, 10],
  ] as const) {
    const r = buy(v, price);
    assert.equal(r.decision.kind, 'rejected');
    assert.equal(r.world, v);
  }
  assert.equal(buy(tired, 10).decision.kind, 'accepted');
  for (const v of [learned(practicalWorld(9, 20), 'haggle'), practicalWorld(10, 20)])
    assert.equal(gameView(v).entities.find((e) => e.id === smith)!.shop![0].buy.price, 10);
});
