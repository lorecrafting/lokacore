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
import { decide } from '../src/mechanics/attributes/rule.ts';
import { derived } from '../src/mechanics/attributes/shared.ts';
import { carryingAdded, carryingExchange } from '../src/mechanics/containment/shared.ts';
import { adjust, level, resourceRef } from '../src/mechanics/resource.ts';
import { apply } from '../src/runtime/apply.ts';
import { gameView } from '../src/view/view.ts';

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

// Breaks: the ceiling loses its floor at 0, so a carry bonus below -max_grams makes it negative
// and every Take fails as precondition_failed instead of admitting weightless items.
test('a carry bonus below -max_grams floors the ceiling at 0 g', () => {
  const crushed = structuredClone(content) as any; // strength 5: 4000 * (5 - 10) = -20000
  crushed.world.derived.carry_grams.terms[0].per_point = 4000;
  const w = chosen('nimble', crushed);
  assert.equal(carryingAdded(w, w.body, 0, { n: 0 }), undefined);
  assert.equal(carryingAdded(w, w.body, 1, { n: 0 }), 'too_heavy');
});

// Breaks: the player profile ignores the hit or damage table (base 75% and 4 damage), or loses the
// clamp at 0 so a negative damage bonus heals the target, or applies the bonus to the NPC.
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
  const fought = round(chosen('strong', blind));
  assert.equal(hp(fought), 14);
  // The dummy's own 0% profile takes no bonus: leaked, it would hit for 3.
  assert.equal(level(fought, fought.body, resourceRef(fought, 'hp')), 10);
  const weak = structuredClone(content) as any;
  weak.world.derived.damage.terms[0].per_point = -10;
  assert.equal(hp(round(chosen('strong', weak))), 20);
});

const hpView = (w: World) => {
  const { current, maximum } = gameView(w).resources!.find((r) => r.resource.key === 'hp')!;
  return [current, maximum];
};

// Breaks: resourceSpec or the GameView keeps the authored maximum 10 (hardy shows 10/10 and never
// regenerates past it), or base() omits resource_maxima so composition refuses a write from 16.
test('constitution 16 raises the hp maximum to 16; the body regenerates to it and spends from it', () => {
  const hardy = chosen('hardy');
  assert.deepEqual(hpView(hardy), [10, 16]);
  const later = wait(hardy, 3 * 3600); // gain 5 per hour boundary from the start value 10
  assert.deepEqual(hpView(later), [16, 16]);
  assert.deepEqual(hpView(wait(chosen('nimble'), 3 * 3600)), [10, 10]);
  const hp = resourceRef(later, 'hp');
  const spent = apply(later, [adjust(later, later.body, hp, -1, {}).op]);
  assert.ok('world' in spent, JSON.stringify(spent));
  assert.equal(level(spent.world, later.body, hp), 15);
});

// Breaks (PM ruling, loka-kgd.11): choose_ancestry writes no zero-amount hp settle before the
// selection that moves the derived hp maximum. Not observable through step today: elapsed time is
// refused before an ancestry is chosen, so the rule is called directly.
test('choosing hardy settles hp at 10 before the selection raises its maximum', () => {
  const w = newWorld(content, '1d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
  const command = {
    payload: { type: 'choose_ancestry', actor_id: w.character, ancestry: 'hardy' },
  };
  const ruled = decide(w, command as never, undefined as never);
  assert.ok(ruled.kind === 'accepted', JSON.stringify(ruled));
  const [settle, select] = ruled.delta.ops;
  assert.deepEqual(
    [
      settle!.op,
      (settle as { resource: { key: string } }).resource.key,
      (settle as { from: number }).from,
      (settle as { to: number }).to,
      select!.op,
    ],
    ['resource.adjust', 'hp', 10, 10, 'character.select'],
  );
});

// Breaks: a combat write checks the hit against the authored maximum 10 (the round faults from 16)
// or commits hp clamped to it, so the stored row after one 1-point hit is not 15.
test('a real attack round commits hp 15 above the authored maximum 10', () => {
  const struck = structuredClone(content) as any;
  struck.npcs['derived_sampler@0.0.1:npc/dummy'].attack = {
    chance: 100,
    damage_min: 1,
    damage_max: 1,
  };
  const w = wait(chosen('hardy', struck), 3 * 3600);
  const hp = resourceRef(w, 'hp');
  const at = encode({ kind: 'resource', resource: hp, entity_id: w.body } as never);
  const fought = wait(
    play(play(w, { type: 'move', direction: 'east' }), {
      type: 'attack',
      target_id: dummy(w),
    }),
    150,
  );
  assert.equal(fought.state.resources?.[at]?.value, 15);
});

// Breaks: the death sequence restores the authored 10 above a derived maximum of 4, so the killing
// round faults composition and the player never returns; or the maximum loses its floor at the
// pool minimum 0 (constitution 16 at -3 per point would read -8).
test('a maximum lowered to 4 reads the start value 10 as 4 and caps the death restore', () => {
  const crushed = structuredClone(content) as any;
  crushed.world.derived.hp_max.terms[0].per_point = -3;
  assert.deepEqual(hpView(chosen('hardy', crushed)), [0, 0]);
  const frail = structuredClone(content) as any; // constitution 16: -1 * (16 - 10) = -6
  frail.world.derived.hp_max.terms[0].per_point = -1;
  frail.npcs['derived_sampler@0.0.1:npc/dummy'].attack = {
    chance: 100,
    damage_min: 9,
    damage_max: 9,
  };
  const w = chosen('hardy', frail);
  assert.deepEqual(hpView(w), [4, 4]);
  const fought = wait(
    play(play(w, { type: 'move', direction: 'east' }), { type: 'attack', target_id: dummy(w) }),
    150,
  );
  assert.equal(gameView(fought).place!.title.key, 'room.hall.title'); // died and returned at the shrine
  assert.deepEqual(hpView(fought), [4, 4]);
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
      (c) => (c.manifest.requires.kernel_api.at_least = '1.39'),
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
        delete c.manifest.requires.capabilities.attributes;
        delete c.lock.capabilities.attributes;
        delete c.attributes;
        delete c.ancestries;
      },
      'UNDECLARED_CAPABILITY',
      at,
    ],
    [
      (c) => {
        delete c.world.combat;
        delete c.npcs['derived_sampler@0.0.1:npc/dummy'].attack;
        delete c.world.derived.carry_grams;
      },
      'SCHEMA_VIOLATION',
      `${at}.damage`,
    ],
    [
      (c) => {
        delete c.world.combat;
        delete c.npcs['derived_sampler@0.0.1:npc/dummy'].attack;
        delete c.world.derived.damage;
        delete c.world.derived.carry_grams;
      },
      'SCHEMA_VIOLATION',
      `${at}.hit_chance`,
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
// outside 1..2^31-1 loads, or a stat outside the four is accepted.
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
  assert.deepEqual(validate('WorldSettings', { derived: { mv_max: ok } }), [
    { path: '/derived/mv_max', code: 'unknown_property' },
  ]);
});
