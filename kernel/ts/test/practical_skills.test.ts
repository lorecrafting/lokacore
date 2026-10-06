import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, step, type World } from '../src/index.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { practicalWorld, learned, ids, pool } from './practical_skills_fixture.ts';
const patch = ids['detail/willow_shade/fenwort_patch'];
const selected = ['0556eeda-6c38-8679-bc0b-5a9848eba57a', '37ef3668-8242-851e-94bc-66e562abebd7'];
const peg = ids['npc/peg'];
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
  run(w, { type: 'harvest', target_id: patch, method: 'careful' }, 'gather_carefully');
function burden(w: World, grams: number): World {
  const item = ids['item/tithe_ledger'];
  return {
    ...w,
    entities: { ...w.entities, [item]: { ...w.entities[item], mass_grams: grams } as never },
    state: { ...w.state, containers: { ...w.state.containers, [item]: w.body } },
  };
}
// Breaks: an aliased careful offer loses literal input/command binding, picks authored order, or transfers only one of two items.
test('loaded careful alias resolves literal input and transfers the two lowest finite IDs', () => {
  const w = burden(learned(practicalWorld(), 'herbalism'), 11960);
  const view = gameView(w);
  const a = view
    .notices!.find((n) => n.id === patch)!
    .actions!.find((a) => a.action_key === 'gather_carefully')!;
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
    selected.map((id) => [id, ids['room/willow_shade'], w.body, 0]),
  );
  assert.deepEqual(
    result.decision.events.map((e: any) => e.payload),
    selected.map((id) => ({ type: 'item_acquired', item_id: id, holder_id: w.body })),
  );
  assert.equal(gameView(result.world).notices!.find((n) => n.id === patch)!.remaining, 10);
  assert.deepEqual(
    selected.map((id) => result.world.state.containers[id]),
    [w.body, w.body],
  );
  assert.equal(
    run(w, { type: 'harvest', target_id: patch, method: 'careful' }, 'harvest').decision.kind,
    'rejected',
  );
});
// Breaks: eligibility ignores INT/MV/acquisition, stock count, or checks each incoming item against the same original load.
test('careful refuses atomically at each independent boundary while ordinary stock-one Harvest remains legal', () => {
  const good = learned(practicalWorld(), 'herbalism');
  const lowStock = {
    ...good,
    state: {
      ...good.state,
      containers: {
        ...good.state.containers,
        ...Object.fromEntries(
          Object.entries(ids)
            .filter(([k]) => k.startsWith('item/fenwort_') && k !== 'item/fenwort_02')
            .map(([, id]) => [id, ids['room/infirmary']]),
        ),
      },
    },
  };
  for (const w of [
    practicalWorld(),
    learned(practicalWorld(9), 'herbalism'),
    learned(practicalWorld(10, 'willow_shade', 3, 4), 'herbalism'),
    burden(good, 11980),
    lowStock,
  ]) {
    const r = gather(w);
    assert.equal(r.decision.kind, 'rejected', JSON.stringify(r.decision));
    assert.equal(r.world, w);
    assert.equal(
      gameView(w)
        .notices!.find((n) => n.id === patch)!
        .actions!.find((a) => a.action_key === 'gather_carefully')!.available,
      false,
    );
  }
  assert.equal(run(lowStock, { type: 'harvest', target_id: patch }).decision.kind, 'accepted');
  assert.equal(
    run(burden(good, 11980), { type: 'harvest', target_id: patch }).decision.kind,
    'accepted',
  );
});
// Breaks: quote display differs from execution, ignores current qualification, alters Sell, or accepts either direction of stale price.
test('one current quote applies all seven floors and conserves a controlled 10p Buy at 9p', () => {
  const w = learned(practicalWorld(10, 'chandler', 20), 'haggle');
  const shelf = gameView(w).entities.find((e) => e.id === peg)!.shop!;
  assert.deepEqual(
    shelf.map((o) => o.buy.price),
    [2, 1, 3, 4, 7, 3, 3],
  );
  assert.deepEqual(
    shelf.map((o) => o.sell.price),
    [1, 1, 2, 2, 4, 2, 2],
  );
  const npc: any = w.entities[peg];
  const controlled = {
    ...w,
    entities: {
      ...w.entities,
      [peg]: {
        ...npc,
        shop: {
          ...npc.shop,
          offers: npc.shop.offers.map((o: any, i: number) => (i ? o : { ...o, buy: 10 })),
        },
      },
    },
  };
  const item = ids['item/torch'];
  const buy = (v: World, quoted_price: number) =>
    run(v, { type: 'buy', provider_id: peg, item_id: item, quoted_price });
  const b = buy(controlled, 9);
  assert.equal(b.decision.kind, 'accepted', JSON.stringify(b.decision));
  assert.deepEqual(
    [
      b.world.state.resources![pool(w, 'pennies')].value,
      b.world.state.resources![pool(w, 'pennies', peg)].value,
    ],
    [11, 29],
  );
  assert.equal(b.world.state.containers[item], w.body);
  const tired = {
    ...controlled,
    state: {
      ...controlled.state,
      resources: {
        ...controlled.state.resources,
        [pool(w, 'mv')]: { ...controlled.state.resources![pool(w, 'mv')], value: 4 },
      },
    },
  };
  assert.equal(gameView(tired).entities.find((e) => e.id === peg)!.shop![0].buy.price, 10);
  for (const [v, price] of [
    [tired, 9],
    [controlled, 10],
  ] as const) {
    const r = buy(v, price);
    assert.equal(r.decision.kind, 'rejected');
    assert.equal(r.world, v);
  }
  assert.equal(buy(tired, 10).decision.kind, 'accepted');
  assert.equal(
    gameView(learned(practicalWorld(9, 'chandler'), 'haggle')).entities.find((e) => e.id === peg)!
      .shop![0].buy.price,
    3,
  );
  assert.equal(
    gameView(practicalWorld(10, 'chandler')).entities.find((e) => e.id === peg)!.shop![0].buy.price,
    3,
  );
});
