// Resources, costs, threshold checks, cooldowns and MV (R5 S6b; 21 §4 Resource, §7 Cost, Check;
// 04 §5.0, §5.3; 00 §4 amendment, §4.2). Worlds are the road known answer
// (protocol/fixtures/cartridge_road_hash.json: hp 0..25 start 10 gain 5, ma 0..100 start 100
// gain 4, mv 0..3 start 3 gain 18; shove_cart costs 1 mv with a threshold of hp 15; pray costs
// 10 ma, cools down 3600 and adds 5 hp), variants re-hashed with node:crypto over sorted-key
// JSON.stringify. Ids are Python's hashlib over the IdSource input (world.test.ts); every
// expected value is hand-derived from those numbers.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { Command } from '../src/contracts.gen.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { gameView, INSTALLED, newWorld, step } from '../src/world.ts';
import { read } from './read.ts';

const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const CHARACTER = 'bd595711-ea5f-89a5-abb0-046cd349d2f9'; // ordinal 0
const BODY = '3d4829ad-9e43-81ef-bc10-66b1b267e157'; // ordinal 1
const CMD = 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b';
const SEED = [1, 2, 3, 4];
const SHOVE = 'ashmere_road@0.0.1:recipe/shove_cart';
const PRAY = 'ashmere_road@0.0.1:recipe/pray';

const sorted = (v: any): any =>
  Array.isArray(v)
    ? v.map(sorted)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, sorted(v[k])]),
        )
      : v;
// A known answer with `f` applied, loaded and fresh.
const world = (f: (c: any) => void = () => {}, fixture = 'cartridge_road_hash.json'): World => {
  const c = structuredClone(read(`protocol/fixtures/${fixture}`).value);
  f(c);
  const text = JSON.stringify(sorted(c));
  const h = createHash('sha256').update(text).digest('hex');
  const bytes = new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${h}"}`);
  const loaded = loadCartridge(bytes, INSTALLED);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], SEED);
};
const cmd = (payload: object): Command =>
  ({ id: CMD, world_context_id: CONTEXT, payload: { actor_id: CHARACTER, ...payload } }) as Command;
const perform = (action: string) => cmd({ type: 'perform', action });
const move = (direction: string) => cmd({ type: 'move', direction });
const wait = (until: number) => cmd({ type: 'wait', until });
const ref = (key: string) => ({
  cartridge_id: 'ashmere_road',
  cartridge_version: '0.0.1',
  kind: 'resource',
  key,
});
const adjust = (key: string, from: number, to: number) => ({
  op: 'resource.adjust',
  writer_group: 0,
  resource: ref(key),
  entity_id: BODY,
  from,
  to,
});
// Runs commands in order, each accepted; returns the last world.
const run = (w: World, ...cs: Command[]) =>
  cs.reduce((at, c) => {
    const s = step(at, c);
    assert.equal(
      s.decision.kind,
      'accepted',
      `${JSON.stringify(c.payload)}: ${JSON.stringify(s.decision)}`,
    );
    return s.world;
  }, w);
const stored = (w: World, key: string) =>
  w.state.resources?.[
    JSON.stringify({ entity_id: BODY, kind: 'resource', resource: sorted(ref(key)) })
  ];
const ops = (w: World, c: Command) => {
  const d = step(w, c).decision;
  return d.kind === 'accepted' ? JSON.parse(JSON.stringify(d.delta.ops)) : d;
};
const rejects = (w: World, c: Command, code: string) => {
  const s = step(w, c);
  assert.deepEqual(s.decision, { kind: 'rejected', error: { code } });
  assert.equal(s.world, w); // nothing changes: no cost, draw, cooldown or time
};

// Breaks: a cost checked but not paid, or a threshold not read from the resource.
test('a failed threshold check still pays its cost; success runs the outcome', () => {
  const w = world();
  const failed = step(w, perform('shove_cart'));
  assert.equal(failed.decision.kind === 'accepted' && failed.decision.outcome, 'failure');
  assert.deepEqual(ops(w, perform('shove_cart')), [adjust('mv', 3, 2)]);
  assert.deepEqual(stored(failed.world, 'mv'), { value: 2, at: 0 });
  assert.equal(failed.world.state.rng, w.state.rng); // a threshold draws nothing
  // hp 15 (difficulty 15, at least): passes.
  const strong = world((c) => (c.resources['ashmere_road@0.0.1:resource/hp'].start = 15));
  const passed = step(strong, perform('shove_cart')).decision;
  assert.equal(passed.kind === 'accepted' && passed.outcome, 'success');
});

// Breaks: the threshold reads the value after this recipe's own costs.
test('a threshold reads the resource before the recipe pays its costs', () => {
  const w = world((c) => {
    c.recipes[SHOVE].check = {
      key: 'shove_cart',
      kind: 'threshold',
      resource: ref('mv'),
      difficulty: 3,
    };
  });
  const d = step(w, perform('shove_cart')).decision;
  assert.equal(d.kind === 'accepted' && d.outcome, 'success'); // mv 3 >= 3, then pays 1
});

// Breaks: a cost paid (or a draw committed) on a rejection, or a cost that would go below the
// minimum admitted. (A rejection returns the input world, so a draw made before it cannot
// commit either.)
test('an unaffordable cost is insufficient_resource before any draw, and changes nothing', () => {
  const lucky = world((c) => {
    c.recipes[SHOVE].check = { key: 'shove_cart', kind: 'luck', chance: 50 };
    c.recipes[SHOVE].costs = [
      { resource: ref('mv'), amount: 2 },
      { resource: ref('mv'), amount: 2 },
    ];
  });
  rejects(lucky, perform('shove_cart'), 'insufficient_resource'); // 3 - 2 - 2 < 0
  const exact = world((c) => (c.recipes[SHOVE].costs = [{ resource: ref('mv'), amount: 3 }]));
  assert.deepEqual(ops(exact, perform('shove_cart')), [adjust('mv', 3, 0)]); // down to the minimum
  const pricey = world((c) => (c.recipes[PRAY].costs = [{ resource: ref('ma'), amount: 101 }]));
  rejects(run(pricey, move('east')), perform('pray'), 'insufficient_resource');
});

// Breaks: a move at 0 mv admitted, or a move not paying 1 mv.
test('a move costs 1 mv and is refused at 0 mv', () => {
  const w = world();
  assert.deepEqual(ops(w, move('east'))[0], adjust('mv', 3, 2));
  const tired = run(w, move('east'), move('west'), move('east'));
  assert.deepEqual(stored(tired, 'mv'), { value: 0, at: 0 });
  rejects(tired, move('west'), 'insufficient_resource');
});

// Breaks: a move charging mv in a cartridge without the pools (resource@1 not locked).
test('a cartridge without the pools moves for free and writes no resource', () => {
  const w = world((c) => {
    delete c.resources;
    delete c.manifest.requires.capabilities.resource;
    delete c.lock.capabilities.resource;
  }, 'cartridge_rooms_hash.json');
  assert.deepEqual(
    ops(w, move('north')).map((o: { op: string }) => o.op),
    ['entity.transfer'],
  );
  assert.equal(step(w, move('north')).world.state.resources, undefined);
});

// Breaks: regeneration counted in whole hours since the write instead of hour boundaries, or
// not stopping at the maximum.
test('regeneration adds gain per hour boundary crossed, stopping at the maximum', () => {
  // mv paid at 3000 (2 left), read at 3700: one boundary (3600), 700 s since the write.
  const w = run(world(), wait(3000), move('east'), wait(3700));
  assert.deepEqual(stored(w, 'mv'), { value: 2, at: 3000 });
  assert.deepEqual(ops(w, move('west'))[0], adjust('mv', 3, 2)); // 2 + 18, stopped at 3
  // hp 10 paid nothing; at 7200 two boundaries: 10 + 2 * 5 = 20.
  const later = run(world(), wait(7200), move('east'));
  assert.deepEqual(ops(later, perform('pray')).slice(0, 2), [
    adjust('ma', 100, 90),
    adjust('hp', 20, 25),
  ]);
});

// Breaks: a resource.adjust step not stopping at the resource's bounds (RecipeStep: add by,
// stopping at the bounds), or emitting a no-op adjust at full value.
test('a resource.adjust step stops at the maximum; at full value it changes nothing', () => {
  // pray at 0 (hp 15), at 3600 (hp 15 + 5 regen = 20, + 5 = 25), then at 7200 hp is 25 already.
  const full = run(world(), move('east'), perform('pray'), wait(3600), perform('pray'), wait(7200));
  const at = step(full, perform('pray')).decision;
  assert.equal(at.kind === 'accepted' && at.outcome, 'performed');
  assert.deepEqual(
    ops(full, perform('pray')).map((o: { op: string }) => o.op),
    ['resource.adjust', 'cooldown.start'], // the ma cost only
  );
  assert.deepEqual(ops(full, perform('pray'))[0], adjust('ma', 88, 78)); // 90 - 10 + 4 at 3600 is 84, + 4 at 7200
  // hp 23 + 5 stops at 25.
  const hurt = world((c) => (c.resources['ashmere_road@0.0.1:resource/hp'].start = 23));
  assert.deepEqual(ops(run(hurt, move('east')), perform('pray'))[1], adjust('hp', 23, 25));
});

// Breaks: the cooldown end computed as last + cooldown, which overflows for a huge cooldown
// (an evaluator_error fault instead of the cooldown refusal).
test('a cooldown of 2^53 - 1 refuses with cooldown, not a fault', () => {
  const once = world((c) => (c.recipes[PRAY].cooldown = Number.MAX_SAFE_INTEGER));
  rejects(run(once, move('east'), wait(3600), perform('pray')), perform('pray'), 'cooldown');
});

// Breaks: < and <= swapped at the cooldown boundary, or no cooldown.start.
test('a cooldown refuses the recipe until exactly its end', () => {
  const w = run(world(), move('east'), perform('pray'));
  assert.deepEqual(Object.values(w.state.cooldowns!), [0]);
  rejects(run(w, wait(3599)), perform('pray'), 'cooldown');
  const again = ops(run(w, wait(3600)), perform('pray'));
  assert.deepEqual(again.at(-1), {
    op: 'cooldown.start',
    writer_group: 0,
    actor_id: CHARACTER,
    action: 'pray',
    from: 0,
    at: 3600,
  });
});

// Breaks: a failed attempt not starting the cooldown.
test('a failed attempt starts the cooldown too', () => {
  const w = world((c) => (c.recipes[SHOVE].cooldown = 60));
  const failed = step(w, perform('shove_cart'));
  assert.equal(failed.decision.kind === 'accepted' && failed.decision.outcome, 'failure');
  rejects(failed.world, perform('shove_cart'), 'cooldown');
});

// Astra A2. Breaks: the GameView advertising a recipe under cooldown or with unaffordable costs,
// or an exit the body cannot pay for, as available (the same world rejects them).
test('the GameView shows cooldowns, unaffordable costs and exhaustion as unavailable', () => {
  const pray = (w: World) => gameView(w).actions.find((a) => a.action_key === 'pray');
  const prayed = run(world(), move('east'), perform('pray'));
  assert.deepEqual(pray(prayed), {
    available: false,
    action_key: 'pray',
    label: 'actions.pray',
    target: { kind: 'none' },
    input: [],
    reason: { code: 'cooldown' },
  });
  assert.equal(pray(run(prayed, wait(3600)))!.available, true);
  const poor = world((c) => (c.recipes[PRAY].costs = [{ resource: ref('ma'), amount: 101 }]));
  assert.deepEqual(pray(run(poor, move('east')))!, {
    ...pray(prayed)!,
    reason: { code: 'insufficient_resource' },
  });
  const tired = run(world(), move('east'), move('west'), move('east'));
  assert.deepEqual(gameView(tired).exits, [
    { available: false, direction: 'west', reason: { code: 'insufficient_resource' } },
  ]);
  assert.deepEqual(gameView(run(tired, wait(3600))).exits, [
    { available: true, direction: 'west' },
  ]);
});
