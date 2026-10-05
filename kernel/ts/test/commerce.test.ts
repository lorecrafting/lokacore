import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  loadCartridge,
  INSTALLED,
  newWorld,
  step,
  gameView,
  type Cartridge,
  type World,
} from '../src/index.ts';
import { key } from '../src/foundation/compose.ts';
import { read } from './read.ts';
const pin = read('protocol/fixtures/missing_child_v018_hash.json');
const loaded = loadCartridge(
  new TextEncoder().encode(JSON.stringify({ cartridge: pin.value, content_hash: pin.sha256 })),
  INSTALLED,
);
assert.ok(loaded.ok, JSON.stringify(loaded));
const fresh = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);
const id = (kind: string, k: string) =>
  fresh.entityIds[`ashmere_missing_child@0.0.18:${kind}/${k}`];
const peg = id('npc', 'peg'),
  torch = id('item', 'torch'),
  ledger = id('item', 'tithe_ledger');
const penny = (entity: string) =>
  key({
    kind: 'resource',
    resource: {
      cartridge_id: 'ashmere_missing_child',
      cartridge_version: '0.0.18',
      kind: 'resource',
      key: 'pennies',
    },
    entity_id: entity,
  });
const balance = (w: World, entity: string) => w.state.resources![penny(entity)].value;
function world(load = 11900): World {
  return {
    ...fresh,
    entities: {
      ...fresh.entities,
      [ledger]: {
        ...(fresh.entities[ledger] as Extract<World['entities'][string], { kind: 'item' }>),
        mass_grams: load,
      },
    },
    state: {
      ...fresh.state,
      containers: {
        ...fresh.state.containers,
        [fresh.body]: fresh.state.containers[peg],
        [ledger]: fresh.body,
      },
    },
  };
}
function run(w: World, verb = 'buy', price = 3, item = torch, provider = peg) {
  return step(
    w,
    {
      id: 'bbbbbbbb-0000-4000-8000-000000000001' as never,
      world_context_id: w.context,
      payload: {
        type: verb,
        actor_id: w.character,
        item_id: item,
        provider_id: provider,
        quoted_price: price,
      },
    } as never,
    1,
  );
}
// Breaks: a purchase omits debit/credit or duplicates stock instead of conserving the exact item.
test('buy at the carrying ceiling, sell and buyback conserve forty pennies and one identity', () => {
  const start = world();
  const bought = run(start);
  assert.equal(bought.decision.kind, 'accepted', JSON.stringify(bought.decision));
  assert.deepEqual([balance(bought.world, fresh.body), balance(bought.world, peg)], [17, 23]);
  assert.equal(bought.world.state.containers[torch], fresh.body);
  const soldout = run(bought.world);
  assert.equal(soldout.decision.kind, 'rejected');
  assert.equal(soldout.world, bought.world);
  const sold = run(bought.world, 'sell', 1);
  assert.equal(sold.decision.kind, 'accepted');
  assert.deepEqual([balance(sold.world, fresh.body), balance(sold.world, peg)], [18, 22]);
  assert.equal(sold.world.state.containers[torch], peg);
  const again = run(sold.world);
  assert.equal(again.decision.kind, 'accepted');
  assert.equal(again.world.state.containers[torch], fresh.body);
});
// Breaks: forged/stale offers bypass shared carrying, custody, participant or payment admission.
test('projection and direct exchange refuse too-heavy, poor, absent and changed-quote purchases atomically', () => {
  const heavy = world(11901),
    poor = world(),
    absent = world();
  const cases: [World, number, string][] = [
    [heavy, 3, 'too_heavy'],
    [
      {
        ...poor,
        state: {
          ...poor.state,
          resources: {
            ...poor.state.resources,
            [penny(fresh.body)]: { ...poor.state.resources![penny(fresh.body)], value: 2 },
          },
        },
      },
      3,
      'insufficient_resource',
    ],
    [
      {
        ...absent,
        state: {
          ...absent.state,
          containers: { ...absent.state.containers, [peg]: fresh.state.containers[fresh.body] },
        },
      },
      3,
      'not_present',
    ],
    [world(), 4, 'invalid_state'],
  ];
  for (const [w, price, code] of cases) {
    const r = run(w, 'buy', price);
    assert.deepEqual(r.decision, { kind: 'rejected', error: { code } });
    assert.equal(r.world, w);
  }
  assert.equal(
    gameView(heavy).entities.find((e) => e.id === peg)!.shop![0].buy.reason,
    'too_heavy',
  );
});
// Breaks: Sell accepts nested/worn/unrelated goods or gives away a container with the active ledger.
test('sell requires direct eligible custody and funded Peg and preserves protected ancestors', () => {
  const bought = run(world(0)).world;
  const slot = Object.values(bought.slots)[0];
  for (const holder of [slot, ledger]) {
    const w = {
      ...bought,
      state: { ...bought.state, containers: { ...bought.state.containers, [torch]: holder } },
    };
    assert.equal(run(w, 'sell', 1).decision.kind, 'rejected');
  }
  assert.equal(run(bought, 'sell', 1, ledger).decision.kind, 'rejected');
  const w = {
    ...bought,
    state: {
      ...bought.state,
      resources: {
        ...bought.state.resources,
        [penny(peg)]: { ...bought.state.resources![penny(peg)], value: 0 },
      },
    },
  };
  assert.deepEqual(run(w, 'sell', 1).decision, {
    kind: 'rejected',
    error: { code: 'insufficient_resource' },
  });
});
import { hash } from '../src/foundation/canonical.ts';
// Breaks: the loader trusts duplicate offers, wrong initial custody or absent explicit merchant funds.
test('loader independently rejects malformed shop stock and funding', () => {
  for (const mode of ['duplicate', 'holder', 'funding', 'api']) {
    const c = structuredClone(pin.value),
      npc = c.npcs['ashmere_missing_child@0.0.18:npc/peg'];
    if (mode === 'duplicate') npc.shop.offers.push(npc.shop.offers[0]);
    if (mode === 'holder')
      c.items['ashmere_missing_child@0.0.18:item/torch'].location = { in: 'room', room: c.entry };
    if (mode === 'funding') delete npc.resource_starts;
    if (mode === 'api') c.manifest.requires.kernel_api.at_least = '1.15';
    const result = loadCartridge(
      new TextEncoder().encode(JSON.stringify({ cartridge: c, content_hash: hash(c) })),
      INSTALLED,
    );
    assert.equal(result.ok, false, mode);
  }
});
