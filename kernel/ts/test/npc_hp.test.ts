// M5-A: five passive cellar rats, exact per-entity HP, and the additive authoring gate.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { encode } from '../src/foundation/canonical.ts';
import { key } from '../src/foundation/compose.ts';
import { INSTALLED, loadCartridge, newWorld, type Cartridge } from '../src/index.ts';
import type { Command } from '../src/contracts.gen.ts';
import { accepted, type World } from '../src/runtime/decision.ts';
import { admit, adopt } from '../src/runtime/proposal.ts';
import { adjust, level, pay, resourceRef, resourceSpec } from '../src/mechanics/resource.ts';
import { read } from './read.ts';

const kat = read('protocol/fixtures/sampler_v007_hash.json');
const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never;
const command = {
  id: 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b' as Command['id'],
  world_context_id: context,
  payload: { type: 'look', actor_id: 'bd595711-ea5f-89a5-abb0-046cd349d2f9' as World['character'] },
} satisfies Command;
const load = (c = kat.value, installed = INSTALLED) => {
  let canonical = '';
  try {
    canonical = encode(c);
  } catch {
    /* malformed numeric input is rejected before hash checking */
  }
  return loadCartridge(
    new TextEncoder().encode(
      JSON.stringify({
        cartridge: c,
        content_hash: createHash('sha256').update(canonical).digest('hex'),
      }),
    ),
    installed,
  );
};
const fresh = (birth = 64800): World => {
  const c = structuredClone(kat.value);
  c.calendar.start = birth;
  if (birth === 0)
    c.resources['ashmere_sampler@0.0.7:resource/hp'].regen = {
      every: 3600,
      by_position: { standing: 5, sitting: 5, resting: 10, sleeping: 10 },
    };
  const loaded = load(c);
  assert.ok(loaded.ok);
  return newWorld(loaded.cartridge as Cartridge, context, [1, 2, 3, 4]);
};
const rats = (w: World) =>
  Object.entries(w.entities)
    .filter(([, e]) => e.kind === 'npc' && e.hp)
    .map(([id]) => id as World['body']);
const apply = (w: World, ops: Parameters<typeof accepted>[2]) =>
  adopt(
    w,
    admit('resource', accepted(w, 'adjusted', ops, [])),
    command,
    () => {
      throw new Error('unexpected allocation');
    },
    1,
  );

// Breaks: clock-zero omission, one shared HP row, wrong birth time, or misplaced rat content.
test('five real rats have distinct required birth rows, player HP10 and MV100', () => {
  for (const birth of [0, 64800]) {
    const w = fresh(birth),
      hp = resourceRef(w, 'hp'),
      ids = rats(w);
    assert.equal(ids.length, 5);
    assert.equal(new Set(ids).size, 5);
    for (const id of ids) {
      assert.deepEqual(
        w.state.resources?.[key({ kind: 'resource', resource: hp, entity_id: id })],
        { value: 6, at: birth },
      );
      assert.deepEqual(resourceSpec(w, id, hp), {
        key: 'hp',
        minimum: 0,
        maximum: 6,
        start: 6,
        gain: 0,
      });
      assert.equal(w.state.containers[id], w.roomIds['ashmere_sampler@0.0.7:room/lantern_cellar']);
    }
    assert.equal(level(w, w.body, hp), 10);
    assert.equal(level(w, w.body, resourceRef(w, 'mv')), 100);
  }
});

// Breaks: constructor/query/compose disagree, apply drops the immutable map, or rat HP shares state.
test('actual admitted adjustment adopts only one rat and keeps effective bounds after elapsed time', () => {
  const w = fresh(),
    [r1, r2] = rats(w),
    hp = resourceRef(w, 'hp');
  const a = adjust(w, r1, hp, -1, {});
  assert.equal(a.op.from, 6);
  assert.equal(a.op.to, 5);
  const adopted = apply(w, [a.op]);
  assert.equal(adopted.decision.kind, 'accepted');
  assert.equal(adopted.world.entityResourceSpecs, w.entityResourceSpecs);
  assert.equal(level(adopted.world, r1, hp), 5);
  assert.equal(level(adopted.world, r2, hp), 6);
  assert.equal(level(adopted.world, w.body, hp), 10);
  const elapsed = { ...adopted.world, state: { ...adopted.world.state, clock: 68400 } };
  assert.equal(level(elapsed, r1, hp), 5);
  for (const by of [2, -6]) {
    const bad = apply(elapsed, [adjust(elapsed, r1, hp, by, {}).op]);
    assert.equal(bad.decision.kind, 'fault');
    assert.equal(bad.world, elapsed);
  }
  assert.equal(adjust(w, r1, hp, 1, {}, true).op.to, 6);
  const costs = pay(w, r1, [
    { resource: hp, amount: 1 },
    { resource: hp, amount: 2 },
  ])!;
  assert.equal(level(apply(w, costs.ops).world, r1, hp), 3);
  assert.equal(apply(w, [a.op, adjust(w, r2, hp, 1, {}).op]).world, w);
});

// Breaks: a malformed saved-like row reaches a query's absent-row start fallback.
test('explicit override queries refuse absent or malformed rows', () => {
  const w = fresh(),
    hp = resourceRef(w, 'hp'),
    id = rats(w)[0];
  const at = key({ kind: 'resource', resource: hp, entity_id: id });
  for (const row of [undefined, { value: 7, at: 64800 }, { value: 6, at: 64801 }])
    assert.equal(
      level(
        { ...w, state: { ...w.state, resources: { ...w.state.resources, [at]: row } as never } },
        id,
        hp,
      ),
      undefined,
    );
});

// Breaks: compiler/loader shape or cross-field validation drifts, or older kernels ignore the addition.
test('loader rejects invalid NPC HP and enforces API 1.4', () => {
  const change = (hp: unknown, api = '1.4') => {
    const c = structuredClone(kat.value);
    c.npcs['ashmere_sampler@0.0.7:npc/cellar_rat_1'].hp = hp;
    c.manifest.requires.kernel_api.at_least = api;
    return c;
  };
  for (const hp of [
    { minimum: 7, maximum: 6, start: 6, gain: 0 },
    { minimum: 0, maximum: 6, start: 7, gain: 0 },
  ]) {
    const result = load(change(hp));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.diagnostic.code, 'RESOURCE_SPEC_INVALID');
  }
  for (const c of read('protocol/fixtures/entity_resource.json').contracts.filter(
    (c: any) => !c.valid,
  ))
    assert.equal(load(change(c.value)).ok, false, c.id);
  const old = load(change({ minimum: 0, maximum: 6, start: 6, gain: 0 }, '1.3'));
  assert.equal(old.ok, false);
  if (!old.ok) assert.equal(old.diagnostic.code, 'KERNEL_API_RANGE_INVALID');
  const unsupported = load(kat.value, { ...INSTALLED, kernel_api: '1.3' });
  assert.equal(unsupported.ok, false);
  if (!unsupported.ok) assert.equal(unsupported.diagnostic.code, 'KERNEL_API_UNSUPPORTED');
});
