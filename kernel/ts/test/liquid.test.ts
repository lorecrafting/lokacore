import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  step,
  gameView,
  type Cartridge,
  type World,
} from '../src/index.ts';
import type { CommandPayload, EntityId, LiquidRow } from '../src/contracts.gen.ts';
import { key } from '../src/foundation/compose.ts';
import { resolved } from '../src/commands/actions.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { liquidActions } from '../src/view/liquid.ts';
import { transition } from '../src/mechanics/liquid/shared.ts';
import { read } from './read.ts';
const pin = read('protocol/fixtures/missing_child_b7_hash.json');
const answers = read('protocol/fixtures/missing_child_b7_ids.json');
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
const prefix = `ashmere_missing_child@${fresh.cartridge.manifest.version}`;
const id = (kind: string, name: string) => fresh.entityIds[`${prefix}:${kind}/${name}`];
const skin = id('item', 'waterskin'),
  spare = id('item', 'spare_waterskin'),
  peg = id('npc', 'peg'),
  bag = id('item', 'satchel'),
  ledger = id('item', 'tithe_ledger');
const well = Object.entries(fresh.details).find(([, d]) => d.liquid_source)![0] as EntityId;
const water = Object.values(fresh.cartridge.liquids!)[0];
const waterRef = {
  cartridge_id: fresh.cartridge.manifest.id,
  cartridge_version: fresh.cartridge.manifest.version,
  kind: 'liquid',
  key: water.key,
};
const row = (quantity: number): LiquidRow => ({ kind: quantity ? waterRef : null, quantity });
const run = (world: World, payload: object) =>
  step(
    world,
    {
      id: 'aaaaaaaa-0000-4000-8000-000000000001',
      world_context_id: world.context,
      payload: { ...payload, actor_id: world.character },
    } as never,
    1,
  );
const contents = (w: World) =>
  JSON.parse(JSON.stringify([w.state.liquids![skin], w.state.liquids![spare]]));
function owned(a = 0, b = 0): World {
  return {
    ...fresh,
    state: {
      ...fresh.state,
      containers: {
        ...fresh.state.containers,
        [fresh.body]: fresh.details[well].room,
        [skin]: fresh.body,
        [spare]: fresh.body,
      },
      liquids: { ...fresh.state.liquids, [skin]: row(a), [spare]: row(b) },
    },
  };
}
const balance = (w: World, holder: string) =>
  w.state.resources![
    key({
      kind: 'resource',
      resource: {
        cartridge_id: fresh.cartridge.manifest.id,
        cartridge_version: fresh.cartridge.manifest.version,
        kind: 'resource',
        key: 'pennies',
      },
      entity_id: holder,
    })
  ].value;
// Breaks: the second offer aliases the original or Buy replaces an exact finite shell.
test('two real shop offers cost eight pennies and retain two empty shell identities', () => {
  let world = {
    ...fresh,
    state: {
      ...fresh.state,
      containers: { ...fresh.state.containers, [fresh.body]: fresh.state.containers[peg] },
    },
  };
  assert.notEqual(skin, spare);
  assert.equal(skin, answers['item/waterskin']);
  assert.equal(spare, answers['item/spare_waterskin']);
  for (const item of [skin, spare]) {
    const next = run(world, { type: 'buy', provider_id: peg, item_id: item, quoted_price: 4 });
    assert.equal(next.decision.kind, 'accepted', JSON.stringify(next.decision));
    world = next.world;
    assert.equal(world.state.containers[item], world.body);
  }
  assert.deepEqual([balance(world, world.body), balance(world, peg)], [12, 28]);
  assert.deepEqual(contents(world), [row(0), row(0)]);
  assert.equal(
    (world.entities[skin] as any).mass_grams + (world.entities[spare] as any).mass_grams,
    1000,
  );
});
// Breaks: Fill overfills, Pour omits debit/free-space limiting, or Drink changes resources/time/RNG.
test('Fill, Drink, partial Pour and Drink conserve finite contents and affect no resource or clock', () => {
  let world = owned();
  for (const vessel_id of [skin, spare])
    world = run(world, { type: 'fill', source_id: well, vessel_id }).world;
  assert.deepEqual(contents(world), [row(4), row(4)]);
  const again = run(world, { type: 'fill', source_id: well, vessel_id: skin });
  assert.equal(again.decision.kind, 'rejected');
  assert.equal(again.world, world);
  const initial = world.state;
  world = run(world, { type: 'drink', vessel_id: spare }).world;
  assert.deepEqual(contents(world), [row(4), row(3)]);
  const poured = run(world, { type: 'pour', source_id: skin, receiver_id: spare });
  assert.equal(poured.decision.kind, 'accepted');
  world = poured.world;
  assert.deepEqual(contents(world), [row(3), row(4)]);
  world = run(world, { type: 'drink', vessel_id: skin }).world;
  assert.deepEqual(contents(world), [row(2), row(4)]);
  assert.deepEqual(world.state.resources, initial.resources);
  assert.equal(world.state.clock, initial.clock);
  assert.deepEqual(world.state.rng, initial.rng);
});
// Breaks: a ground/corpse/foreign/closed vessel is usable merely because its identity is known.
test('liquid refusal participants and custody leave every row unchanged while open nested skins work', () => {
  const start = owned(4, 3);
  const cases: [World, object][] = [
    [start, { type: 'pour', source_id: skin, receiver_id: skin }],
    [owned(4, 4), { type: 'pour', source_id: skin, receiver_id: spare }],
    [owned(0, 0), { type: 'drink', vessel_id: skin }],
    [start, { type: 'fill', source_id: skin, vessel_id: spare }],
    [
      start,
      { type: 'pour', source_id: 'aaaaaaaa-0000-4000-8000-000000000099', receiver_id: spare },
    ],
    ...[start.body, start.state.containers[start.body], peg].slice(1).map(
      (holder) =>
        [
          {
            ...start,
            state: { ...start.state, containers: { ...start.state.containers, [skin]: holder } },
          },
          { type: 'drink', vessel_id: skin },
        ] as [World, object],
    ),
  ];
  for (const [w, p] of cases) {
    const result = run(w, p);
    assert.notEqual(result.decision.kind, 'accepted');
    assert.equal(result.world, w);
  }
  const nested = {
    ...start,
    state: {
      ...start.state,
      containers: { ...start.state.containers, [skin]: bag, [bag]: start.body },
    },
  };
  assert.equal(run(nested, { type: 'drink', vessel_id: skin }).decision.kind, 'accepted');
});
function massWorld(load: number): World {
  const w = owned();
  return {
    ...w,
    cartridge: {
      ...w.cartridge,
      liquids: { [`${prefix}:liquid/water`]: { ...water, grams_per_unit: 2 } },
    },
    entities: {
      ...w.entities,
      [skin]: {
        ...(w.entities[skin] as any),
        mass_grams: 100,
        vessel: { ...(w.entities[skin] as any).vessel, capacity: 10 },
      },
      [ledger]: { ...(w.entities[ledger] as any), mass_grams: load },
    },
    liquidSpecs: { ...w.liquidSpecs, [skin]: { capacity: 10, kinds: [waterRef] } },
    state: { ...w.state, containers: { ...w.state.containers, [spare]: peg, [ledger]: w.body } },
  };
}
// Breaks: Fill ignores added liquid weight or rejects equality; neutral Pour wrongly rechecks existing overload.
test('Fill includes liquid mass, admits equality, and owned Pour/Drink remain legal while overloaded', () => {
  const tooMuch = massWorld(11900),
    exact = massWorld(11880);
  const refused = run(tooMuch, { type: 'fill', source_id: well, vessel_id: skin });
  assert.equal(refused.decision.kind, 'rejected');
  assert.equal(refused.world, tooMuch);
  assert.equal(
    run(exact, { type: 'fill', source_id: well, vessel_id: skin }).decision.kind,
    'accepted',
  );
  const loaded = {
    ...owned(4, 3),
    entities: {
      ...owned().entities,
      [ledger]: { ...(fresh.entities[ledger] as any), mass_grams: 12000 },
    },
    state: {
      ...owned(4, 3).state,
      containers: { ...owned(4, 3).state.containers, [ledger]: fresh.body },
    },
  };
  assert.equal(
    run(loaded, { type: 'pour', source_id: skin, receiver_id: spare }).decision.kind,
    'accepted',
  );
  assert.equal(run(loaded, { type: 'drink', vessel_id: skin }).decision.kind, 'accepted');
});
// Breaks: incoming carrying reads a filled shell's empty weight, or liquid projection hides exact pairs/faults.
test('Take and Buy reject filled mass above ceiling and GameView exposes exact current pairs', () => {
  const w = owned(4, 3),
    other = 10501;
  const ground = {
    ...w,
    entities: {
      ...w.entities,
      [ledger]: { ...(fresh.entities[ledger] as any), mass_grams: other },
    },
    state: {
      ...w.state,
      containers: {
        ...w.state.containers,
        [spare]: peg,
        [skin]: w.state.containers[w.body],
        [ledger]: w.body,
      },
    },
  };
  assert.equal(
    (run(ground, { type: 'take', item_id: skin }).decision as any).error.code,
    'too_heavy',
  );
  const shelf = {
    ...ground,
    state: {
      ...ground.state,
      containers: {
        ...ground.state.containers,
        [w.body]: ground.state.containers[peg],
        [skin]: peg,
      },
    },
  };
  const bought = run(shelf, { type: 'buy', provider_id: peg, item_id: skin, quoted_price: 4 });
  assert.equal((bought.decision as any).error.code, 'too_heavy');
  assert.equal(bought.world, shelf);
  const view = gameView(w),
    actions = view.inventory.find((e) => e.id === skin)!.actions;
  assert.ok(
    actions.some(
      (a) =>
        a.action_key === 'pour' &&
        a.available &&
        JSON.stringify(a.target_ids) === JSON.stringify([skin, spare]),
    ),
  );
  assert.ok(
    view
      .notices!.find((n) => n.id === well)!
      .actions!.some(
        (a) =>
          a.action_key === 'fill' && JSON.stringify(a.target_ids) === JSON.stringify([well, spare]),
      ),
  );
  assert.equal(
    transition(
      w,
      { type: 'pour', actor_id: w.character, source_id: skin, receiver_id: spare },
      { n: 100000 },
    ),
    'budget_exceeded',
  );
});
// Breaks: a last partial serving is consumed, an exhausted shell keeps its kind, or different kinds mix.
test('authored larger servings refuse a partial last drink and exhausted Pour keeps an empty shell', () => {
  const w = owned(7, 4);
  const tuned = {
    ...w,
    cartridge: {
      ...w.cartridge,
      liquids: { [`${prefix}:liquid/water`]: { ...water, drink_amount: 2 } },
    },
    liquidSpecs: {
      ...w.liquidSpecs,
      [skin]: { capacity: 10, kinds: [waterRef] },
      [spare]: { capacity: 7, kinds: [waterRef] },
    },
  };
  const drunk = run(tuned, { type: 'drink', vessel_id: skin });
  assert.equal(drunk.decision.kind, 'accepted');
  assert.equal(drunk.world.state.liquids![skin].quantity, 5);
  const last = {
    ...tuned,
    state: { ...tuned.state, liquids: { ...tuned.state.liquids, [skin]: row(1) } },
  };
  const refused = run(last, { type: 'drink', vessel_id: skin });
  assert.equal(refused.decision.kind, 'rejected');
  assert.equal(refused.world, last);
  const poured = run(
    {
      ...tuned,
      state: {
        ...tuned.state,
        liquids: { ...tuned.state.liquids, [skin]: row(2), [spare]: row(0) },
      },
    },
    { type: 'pour', source_id: skin, receiver_id: spare },
  );
  assert.equal(poured.decision.kind, 'accepted');
  assert.deepEqual(contents(poured.world), [row(0), row(2)]);
  assert.equal(poured.world.state.containers[skin], poured.world.body);
  const oilRef = { ...waterRef, key: 'oil' };
  const mixed = {
    ...tuned,
    cartridge: {
      ...tuned.cartridge,
      liquids: {
        ...tuned.cartridge.liquids,
        [`${prefix}:liquid/oil`]: { ...water, key: 'oil' as never },
      },
    },
    liquidSpecs: { ...tuned.liquidSpecs, [spare]: { capacity: 7, kinds: [waterRef, oilRef] } },
    state: {
      ...tuned.state,
      liquids: { ...tuned.state.liquids, [spare]: { kind: oilRef, quantity: 4 } },
    },
  };
  const noMix = run(mixed, { type: 'pour', source_id: skin, receiver_id: spare });
  assert.equal(noMix.decision.kind, 'rejected');
  assert.equal(noMix.world, mixed);
});
// Breaks: an owned closed/locked holder passes the ownership walk, or a foreign room source is accepted.
test('closed owned nested vessels and exact out-of-room sources refuse without a write', () => {
  const w = owned(4, 3),
    trunk = id('item', 'trunk');
  const closed = {
    ...w,
    state: { ...w.state, containers: { ...w.state.containers, [trunk]: w.body, [skin]: trunk } },
  };
  const noDrink = run(closed, { type: 'drink', vessel_id: skin });
  assert.equal(noDrink.decision.kind, 'rejected');
  assert.equal(noDrink.world, closed);
  const away = {
    ...w,
    state: {
      ...w.state,
      containers: { ...w.state.containers, [w.body]: fresh.state.containers[fresh.body] },
    },
  };
  const noFill = run(away, { type: 'fill', source_id: well, vessel_id: spare });
  assert.equal(noFill.decision.kind, 'rejected');
  assert.equal(noFill.world, away);
});

// Breaks: projection swallows a shared query fault and silently removes legal pair controls.
test('liquid pair projection fails at the same exhausted budget as direct admission', () => {
  const w = owned(4, 3);
  assert.throws(
    () => liquidActions(w, w.character, skin, resolved(w, w.character), { n: 100000 }),
    /budget_exceeded/,
  );
});

// Breaks: liquid candidates bypass keyed ActionSet target/input/policy admission or lose their primary target.
test('authored liquid overrides project the same availability as the exact invocation', () => {
  const base = owned(3, 2);
  for (const [type, targets, scope] of [
    ['fill', [well, spare], 'inspectable_details'],
    ['pour', [skin, spare], 'inventory'],
    ['drink', [skin], 'inventory'],
  ] as const) {
    for (const [variant, target, input, policy, code] of [
      ['allowed', { kind: 'entity', scopes: [scope] }, [], { op: 'all', items: [] }, undefined],
      ['target', { kind: 'none' }, [], { op: 'all', items: [] }, 'unsupported_capability'],
      [
        'input',
        { kind: 'entity', scopes: [scope] },
        ['direction'],
        { op: 'all', items: [] },
        'unsupported_capability',
      ],
      [
        'policy',
        { kind: 'entity', scopes: [scope] },
        [],
        { op: 'any', items: [] },
        'invalid_state',
      ],
    ] as const) {
      const w: World = {
        ...base,
        cartridge: {
          ...base.cartridge,
          actions: {
            ...base.cartridge.actions,
            [type]: {
              key: type,
              command: type,
              label: `action.${type}`,
              target,
              input,
              priority: 0,
              policy: { policy_version: 1, root: policy },
            } as never,
          },
        },
      };
      const shown = liquidActions(w, w.character, targets[0], resolved(w, w.character), {
        n: 0,
      }).find(
        (a) => a.action_key === type && JSON.stringify(a.target_ids) === JSON.stringify(targets),
      )!;
      assert.equal(shown.available, code === undefined, `${type}/${variant}`);
      assert.equal(shown.available ? undefined : shown.reason.code, code, `${type}/${variant}`);
      const identified = identify('liquid-test', w.character, {
        invocation_id: 'bbbbbbbb-0000-4000-8000-000000000001',
        actor_id: w.character,
        action_key: type,
        target_ids: targets,
        input: {},
      });
      assert.equal(identified.kind, 'identified');
      if (identified.kind !== 'identified') throw new Error('identified');
      const command = resolve(w, identified);
      const decision = 'id' in command ? step(w, command, 1, shown.action_key).decision : command;
      assert.equal(decision.kind, code ? 'rejected' : 'accepted', `${type}/${variant}`);
      if (decision.kind === 'rejected') assert.equal(decision.error.code, code);
    }
  }
});
