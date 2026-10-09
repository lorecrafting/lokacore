// Toolbox row 2 on the compiled derived sampler: strength 5 (nimble) and 15 (strong) move the
// player's hit chance, damage and carry ceiling by the cartridge's tables.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { encode } from '../src/foundation/canonical.ts';
import { validate } from '../src/foundation/validate.ts';
import { derived } from '../src/mechanics/attributes/shared.ts';
import { carryingAdded, carryingExchange } from '../src/mechanics/containment/shared.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-derived-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/derived_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;
const anvil = (w: World) => w.entityIds['derived_sampler@0.0.1:item/anvil'];
const dummy = (w: World) => w.entityIds['derived_sampler@0.0.1:npc/dummy'];
let n = 0;
function act(w: World, p: object) {
  n += 1;
  return step(
    w,
    {
      id: `dddddddd-5555-4333-8444-${String(n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p } as never,
    },
    n,
  );
}
function play(w: World, p: object): World {
  const r = act(w, p);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const chosen = (ancestry: string, c: Cartridge = content) =>
  play(newWorld(c, '1d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]), {
    type: 'choose_ancestry',
    ancestry,
  });
function wait(w: World, seconds: number): World {
  n += 1;
  const run_id = 'aaaaaaaa-0000-4000-8000-000000000020';
  const until = w.state.clock + seconds;
  const r = stepElapsed(
    w,
    {
      id: elapsedCommandId(run_id, w.context, w.state.clock, until) as never,
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id, from: w.state.clock, until },
    } as never,
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}

// Breaks: truncation instead of floor (nimble damage -2), a dropped divisor or pivot, or the
// definition start read instead of the selected value (strong would match nimble).
test('each table derives floor(sum per_point * (value - pivot) / divisor) from the selected value', () => {
  const table = content.world!.derived!;
  const rows: [string, number, number, number][] = [
    ['nimble', -25, -3, -5000],
    ['strong', 25, 2, 5000],
  ];
  for (const [ancestry, hit, damage, carry] of rows) {
    const w = chosen(ancestry);
    assert.deepEqual(
      [table.hit_chance, table.damage, table.carry_grams].map((s) => derived(w, w.character, s)),
      [hit, damage, carry],
      ancestry,
    );
  }
});

// Breaks: a carry path keeps the authored 10000 g ceiling, so the 8000 g anvil fits at strength 5.
test('strength 5 cannot lift the anvil on any carry path; strength 15 can', () => {
  const nimble = chosen('nimble');
  const strong = chosen('strong');
  assert.deepEqual(act(nimble, { type: 'take', item_id: anvil(nimble) }).decision, {
    kind: 'rejected',
    error: { code: 'too_heavy' },
  });
  play(strong, { type: 'take', item_id: anvil(strong) });
  for (const [w, expected] of [
    [nimble, 'too_heavy'],
    [strong, undefined],
  ] as const) {
    assert.equal(carryingAdded(w, w.body, 8000, { n: 0 }), expected);
    assert.equal(carryingExchange(w, w.body, [], [anvil(w)], { n: 0 }), expected);
  }
});

// Breaks: the player profile ignores the hit or damage table (base 75% and 4 damage), or loses the
// clamp at 0 so a negative damage bonus heals the target.
test('strength 15 always hits the dummy for 6; a bonus below zero damage deals 0', () => {
  const hp = (w: World) => level(w, dummy(w), resourceRef(w, 'hp'));
  const round = (w: World) =>
    wait(
      play(play(w, { type: 'move', direction: 'east' }), {
        type: 'attack',
        target_id: dummy(w),
      }),
      150,
    );
  assert.equal(hp(round(chosen('strong'))), 14);
  const blind = structuredClone(content) as any; // base chance 0: only the +100 bonus hits
  blind.world.combat.player_attack.chance = 0;
  blind.world.derived.hit_chance.terms[0].per_point = 20;
  assert.equal(hp(round(chosen('strong', blind))), 14);
  const weak = structuredClone(content) as any;
  weak.world.derived.damage.terms[0].per_point = -10;
  assert.equal(hp(round(chosen('strong', weak))), 20);
});

// Breaks: the loader drops a derived-table check, so an artifact with a dangling attribute,
// a missing owner or an old API floor loads and fails in play.
test('the loader refuses each unsound derived table', () => {
  const source = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  const at = '.cartridge.world.derived';
  const rows: [(c: any) => void, string, string][] = [
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.38'),
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
    [
      (c) => (c.world.derived.damage.terms[0].attribute.key = 'luck'),
      'UNRESOLVED_REFERENCE',
      `${at}.damage.terms[0].attribute`,
    ],
    [(c) => delete c.world.carry, 'SCHEMA_VIOLATION', `${at}.carry_grams`],
    [
      (c) => {
        delete c.world.combat;
        delete c.npcs['derived_sampler@0.0.1:npc/dummy'].attack;
        delete c.world.derived.carry_grams;
      },
      'SCHEMA_VIOLATION',
      `${at}.damage`,
    ],
  ];
  for (const [change, code, path] of rows) {
    const c = structuredClone(source);
    change(c);
    const canonical = encode(c);
    const sha256 = createHash('sha256').update(canonical).digest('hex');
    const r = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
      INSTALLED,
    );
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [code, path]);
  }
});

// Breaks: a compiled table without terms, a term missing a field, an extra field or a divisor
// outside 1..2^31-1 loads, or a stat outside the three (hp_max is loka-kgd.8) is accepted.
test('a derived table requires its terms and a positive 32-bit divisor', () => {
  const term = {
    attribute: { cartridge_id: 'c', cartridge_version: '1.0.0', kind: 'attribute', key: 'str' },
    per_point: 1,
    pivot: 10,
  };
  const ok = { terms: [term], divisor: 2 };
  assert.deepEqual(validate('DerivedStat', ok), []);
  const rows: [unknown, string, string][] = [
    [{}, '/terms', 'missing_property'],
    [{ terms: [] }, '/terms', 'too_few_items'],
    [{ ...ok, extra: 1 }, '/extra', 'unknown_property'],
    [{ terms: [{ ...term, extra: 1 }] }, '/terms/0/extra', 'unknown_property'],
    [{ ...ok, divisor: 0 }, '/divisor', 'below_minimum'],
    [{ ...ok, divisor: 2147483648 }, '/divisor', 'above_maximum'],
    ...(['attribute', 'per_point', 'pivot'] as const).map((field): [unknown, string, string] => {
      const partial: Record<string, unknown> = { ...term };
      delete partial[field];
      return [{ terms: [partial] }, `/terms/0/${field}`, 'missing_property'];
    }),
  ];
  for (const [value, path, code] of rows)
    assert.deepEqual(validate('DerivedStat', value), [{ path, code }], path);
  assert.deepEqual(validate('WorldSettings', { derived: { hp_max: ok } }), [
    { path: '/derived/hp_max', code: 'unknown_property' },
  ]);
});
