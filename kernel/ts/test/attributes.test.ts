// attributes@1 (06 §21 and 00 §4.3 amendments 2026-10-03): attributes are content, read by
// stat_compare; resource_compare reads the current value of the actor's pool. Worlds are the road
// known answer (protocol/fixtures/cartridge_road_hash.json) with attributes@1 locked, str 14,
// dex 12, con 13, int 10, spi 9, per 11, hp 0..20 start 20, mv 0..82 gain 18 and a pool grit
// -100..100 start 0, re-hashed with node:crypto over sorted-key JSON.stringify. Ids as in
// resources.test.ts; every expected value is hand-derived from those numbers.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { CharacterId, Command, Policy } from '../src/contracts.gen.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { check } from '../src/invariants.ts';
import { holds } from '../src/policy.ts';
import { gameView, INSTALLED, newWorld, step } from '../src/world.ts';
import { read } from './read.ts';

const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const CHARACTER = 'bd595711-ea5f-89a5-abb0-046cd349d2f9' as CharacterId; // ordinal 0
const BODY = '3d4829ad-9e43-81ef-bc10-66b1b267e157'; // ordinal 1
const AT = 'ashmere_road@0.0.1:';
const STATS = { str: 14, dex: 12, con: 13, int: 10, spi: 9, per: 11 };

const sorted = (v: any): any =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(
        Object.keys(v)
          .sort()
          .map((k) => [k, sorted(v[k])]),
      )
    : Array.isArray(v)
      ? v.map(sorted)
      : v;
const ref = (kind: string, key: string) => ({
  cartridge_id: 'ashmere_road',
  cartridge_version: '0.0.1',
  kind,
  key,
});
const stat = (key: string, at_least: number) =>
  ({ op: 'stat_compare', attribute: ref('attribute', key), at_least }) as Policy;
const pool = (key: string, at_least: number) =>
  ({ op: 'resource_compare', resource: ref('resource', key), at_least }) as Policy;

// The road known answer with the attributes above, `f` applied, loaded and fresh.
const world = (f: (c: any) => void = () => {}): World => {
  const c = structuredClone(read('protocol/fixtures/cartridge_road_hash.json').value);
  c.manifest.requires.capabilities.attributes = 1;
  c.lock.capabilities.attributes = 1;
  c.attributes = Object.fromEntries(
    Object.entries(STATS).map(([key, start]) => [`${AT}attribute/${key}`, { key, start }]),
  );
  Object.assign(c.resources[`${AT}resource/hp`], { maximum: 20, start: 20 });
  c.resources[`${AT}resource/mv`].maximum = 82;
  c.resources[`${AT}resource/grit`] = {
    key: 'grit',
    minimum: -100,
    maximum: 100,
    start: 0,
    gain: 0,
  };
  f(c);
  const text = JSON.stringify(sorted(c));
  const h = createHash('sha256').update(text).digest('hex');
  const loaded = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${h}"}`),
    INSTALLED,
  );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], [1, 2, 3, 4]);
};
const table = (w: World, rows: [Policy, boolean][]) => {
  for (const [p, want] of rows) assert.equal(holds(w, CHARACTER, p), want, JSON.stringify(p));
};

// Breaks: >= read as >, the attribute's start not reaching the world, or `not` over the leaf.
test('stat_compare holds at the start value and not one above', () => {
  table(world(), [
    [stat('str', 14), true],
    [stat('str', 15), false],
    [stat('spi', 9), true],
    [stat('spi', 10), false],
    [{ op: 'not', item: stat('str', 15) }, true],
  ]);
});

// Breaks: >= read as >, the spec's start read instead of the regenerated current value, a
// negative pool mishandled, or a pool read for an actor without a body.
test('resource_compare reads the current value of the pool on the actor body', () => {
  const w = world();
  table(w, [
    [pool('hp', 20), true],
    [pool('hp', 21), false],
    [pool('grit', 0), true],
    [pool('grit', 1), false],
    [pool('grit', -100), true],
  ]);
  // mv stored 1 at time 0, one hour later: 1 + 18 = 19.
  const row = JSON.stringify({
    entity_id: BODY,
    kind: 'resource',
    resource: sorted(ref('resource', 'mv')),
  });
  const rested = {
    ...w,
    state: { ...w.state, clock: 3600, resources: { [row]: { value: 1, at: 0 } } },
  };
  table(rested, [
    [pool('mv', 19), true],
    [pool('mv', 20), false],
  ]);
  assert.equal(holds(w, 'other' as CharacterId, pool('grit', -100)), false);
});

// Breaks: the leaf read on something other than the actor's body (its id, a stale start), or the
// GameView and admission disagreeing on it. Moving east to the wayside pays 1 mv.
test('a recipe gated on mv at least 2 is offered and admitted at mv 2, refused at mv 1', () => {
  const perform = {
    id: 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b',
    world_context_id: CONTEXT,
    payload: { actor_id: CHARACTER, type: 'perform', action: 'pray' },
  } as Command;
  for (const [start, available] of [
    [3, true],
    [2, false],
  ] as const) {
    const fresh = world((c) => {
      c.resources[`${AT}resource/mv`].start = start;
      c.recipes[`${AT}recipe/pray`].policy.root = pool('mv', 2);
    });
    const moved = step(
      fresh,
      { ...perform, payload: { actor_id: CHARACTER, type: 'move', direction: 'east' } } as Command,
      0,
    );
    assert.equal(moved.decision.kind, 'accepted');
    const w = moved.world;
    const view = gameView(w);
    const s = step(w, perform, 0);
    assert.equal(
      check('gameview_agrees_with_admission', { view, command: perform, decision: s.decision }),
      true,
    );
    const entry = view.actions.find((a) => a.action_key === 'pray')!;
    if (available) {
      assert.equal(entry.available, true);
      assert.equal(s.decision.kind, 'accepted');
    } else {
      assert.deepEqual(entry.available ? undefined : entry.reason, { code: 'invalid_state' });
      assert.deepEqual(s.decision, { kind: 'rejected', error: { code: 'invalid_state' } });
      assert.equal(s.world, w);
    }
  }
});
