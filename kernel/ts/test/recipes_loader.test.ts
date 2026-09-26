// The loader on recipes and rooms' action contributions (R5 S5; protocol/cartridge.schema.json
// DiagnosticCode), and on v1 action policies (S3 review N1). Mutants of the bell and hello known
// answers are re-hashed with node:crypto over sorted-key JSON.stringify (the canonical form for
// these values), never by the kernel; expected diagnostics are hand-written.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { loadCartridge } from '../src/cartridge.ts';
import { INSTALLED } from '../src/world.ts';
import { read } from './read.ts';

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
const load = (fixture: string, f: (c: any) => void) => {
  const c = structuredClone(read(`protocol/fixtures/${fixture}`).value);
  f(c);
  const text = JSON.stringify(sorted(c));
  const h = createHash('sha256').update(text).digest('hex');
  const bytes = new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${h}"}`);
  return loadCartridge(bytes, INSTALLED);
};
const fails = (
  f: (c: any) => void,
  code: string,
  path: string,
  data = {},
  suggested: string[] = [],
  fixture = 'cartridge_bell_hash.json',
) =>
  assert.deepEqual(load(fixture, f), {
    ok: false,
    diagnostic: {
      severity: 'error',
      code,
      path,
      message_key: `diagnostics.${code.toLowerCase()}`,
      data,
      suggested_capabilities: suggested,
    },
  });
const RECIPE = 'ashmere_bell@0.0.1:recipe/ring_bell';
const AT = `.cartridge.recipes["${RECIPE}"]`;
const recipe = (c: any) => c.recipes[RECIPE];
const success = (c: any) => recipe(c).outcomes.success;

// Breaks: the kernel would look up a detail, room, fact or text that does not exist (a crash
// or a raw key at play time) because the loader let the artifact in.
test("a recipe's unknown target, fact or text is UNRESOLVED_REFERENCE", () => {
  fails((c) => (recipe(c).target.detail = 'gong'), 'UNRESOLVED_REFERENCE', `${AT}.target.detail`, {
    target: 'gong',
  });
  fails((c) => (recipe(c).target.room.key = 'crypt'), 'UNRESOLVED_REFERENCE', `${AT}.target.room`, {
    target: 'ashmere_bell@0.0.1:room/crypt',
  });
  fails(
    (c) => (success(c).sequence[0].fact.key = 'bell_tolled'),
    'UNRESOLVED_REFERENCE',
    `${AT}.outcomes.success.sequence[0].fact`,
    { target: 'ashmere_bell@0.0.1:fact/bell_tolled' },
  );
  fails((c) => delete c.text['actions.ring_bell'], 'UNRESOLVED_REFERENCE', `${AT}.label`, {
    target: 'actions.ring_bell',
  });
  fails(
    (c) => delete c.text['narration.ring_bell.observers'],
    'UNRESOLVED_REFERENCE',
    `${AT}.outcomes.success.narration.observers`,
    { target: 'narration.ring_bell.observers' },
  );
  assert.ok(load('cartridge_bell_hash.json', (c) => delete success(c).narration.observers).ok);
});

// Review F1, Astra A3. Breaks: an artifact whose recipe shares an action's or an engine verb's
// key installs, and one definition silently wins at play time.
test("a recipe with an action's or a registered command's key is DUPLICATE_DEFINITION", () => {
  const renamed = (key: string) => (c: any) => {
    const r = { ...recipe(c), key };
    delete c.recipes[RECIPE];
    c.recipes[`ashmere_bell@0.0.1:recipe/${key}`] = r;
  };
  fails(
    renamed('look'),
    'DUPLICATE_DEFINITION',
    '.cartridge.recipes["ashmere_bell@0.0.1:recipe/look"]',
  );
  fails(
    (c) =>
      (c.actions['ashmere_bell@0.0.1:action/ring_bell'] = {
        key: 'ring_bell',
        label: 'actions.ring_bell',
        target: { kind: 'none' },
        command: 'look',
        priority: 0,
        input: [],
        policy: recipe(c).policy,
        accessibility: 'actions.ring_bell',
      }),
    'DUPLICATE_DEFINITION',
    AT,
  );
});

// Breaks: a room contribution naming no action loads (a typo silently changes nothing).
test("a room's contribution naming no verb, action or recipe is UNRESOLVED_REFERENCE", () => {
  const room = (c: any) => c.rooms['ashmere_bell@0.0.1:room/belfry'];
  const ops = [{ op: 'subtract', actions: ['take', 'ring_bell', 'ring_gong'] }];
  fails(
    (c) => (room(c).actions = ops),
    'UNRESOLVED_REFERENCE',
    '.cartridge.rooms["ashmere_bell@0.0.1:room/belfry"].actions[0].actions[2]',
    { target: 'ring_gong' },
  );
});

// Breaks: a recipe, or a step's operation, loads without its owner in the lock (05 §6).
test('a recipe and its steps without their owners locked are UNDECLARED_CAPABILITY', () => {
  const cases = [
    ['action_recipe', AT],
    ['fact', `${AT}.outcomes.success.sequence[0].op`],
  ];
  for (const [key, path] of cases) {
    const without = (c: any) => {
      delete c.manifest.requires.capabilities[key];
      delete c.lock.capabilities[key];
    };
    fails(without, 'UNDECLARED_CAPABILITY', path, { capability: key }, [`${key}@1`]);
  }
});

// S3 review N1. Breaks: a v1 artifact whose action policy compares an undeclared fact loads,
// then throws at decision time now that action policies are evaluated.
test("a v1 action policy's undeclared fact is UNRESOLVED_REFERENCE", () => {
  const talk = 'ashmere_hello@0.0.1:action/talk';
  const fact = { cartridge_id: 'ashmere_hello', cartridge_version: '0.0.1', kind: 'fact' };
  fails(
    (c) =>
      (c.actions[talk].policy.root = {
        op: 'fact_compare',
        fact: { ...fact, key: 'nope' },
        equals: true,
      }),
    'UNRESOLVED_REFERENCE',
    `.cartridge.actions["${talk}"].policy.root.fact`,
    { target: 'ashmere_hello@0.0.1:fact/nope' },
    [],
    'cartridge_hash.json',
  );
});

// R5 S6a. The bell with ring_bell given a luck check and a failure outcome, check@1 and
// schedule@1 locked.
const checked = (c: any) => {
  for (const key of ['check', 'schedule'])
    c.manifest.requires.capabilities[key] = c.lock.capabilities[key] = 1;
  recipe(c).check = { key: 'ring_true', kind: 'luck', chance: 50 };
  recipe(c).outcomes.failure = {
    sequence: [{ ...success(c).sequence[0], value: false }],
    narration: { actor: 'narration.ring_bell.actor' },
  };
};
const and = (f: (c: any) => void) => (c: any) => (checked(c), f(c));

// Breaks: a checked recipe loads with no failure outcome (the kernel has none to run when the
// check fails), or a failure outcome without a check loads and is dead content.
test('a recipe has a failure outcome exactly when it has a check (OUTCOME_MISMATCH)', () => {
  assert.ok(load('cartridge_bell_hash.json', checked).ok);
  const nofailure = and((c) => delete recipe(c).outcomes.failure);
  fails(nofailure, 'OUTCOME_MISMATCH', `${AT}.outcomes`);
  fails(
    and((c) => delete recipe(c).check),
    'OUTCOME_MISMATCH',
    `${AT}.outcomes`,
  );
});

// Breaks: the failure outcome's fact, text or step owner goes unchecked, so a failed check
// crashes or shows a raw key at play time; a check loads without check@1 locked.
test("a failure outcome's references and owners, and the check's, are checked", () => {
  fails(
    and((c) => (recipe(c).outcomes.failure.sequence[0].fact.key = 'bell_cracked')),
    'UNRESOLVED_REFERENCE',
    `${AT}.outcomes.failure.sequence[0].fact`,
    { target: 'ashmere_bell@0.0.1:fact/bell_cracked' },
  );
  fails(
    and((c) => (recipe(c).outcomes.failure.narration.actor = 'narration.cracked')),
    'UNRESOLVED_REFERENCE',
    `${AT}.outcomes.failure.narration.actor`,
    { target: 'narration.cracked' },
  );
  for (const [key, path] of [
    ['check', `${AT}.check`],
    ['fact', `${AT}.outcomes.failure.sequence[0].op`],
  ])
    fails(
      and((c) => {
        delete c.manifest.requires.capabilities[key];
        delete c.lock.capabilities[key];
      }),
      'UNDECLARED_CAPABILITY',
      path,
      { capability: key },
      [`${key}@1`],
    );
});

// Breaks: a time_window node loads without schedule@1 locked, or with an empty window (from
// equal to to) that never holds.
test('time_window needs schedule@1 and a non-empty window', () => {
  const window = (from: number, to: number) => (c: any) =>
    (recipe(c).policy.root = { op: 'time_window', from, to });
  assert.ok(load('cartridge_bell_hash.json', and(window(18, 6))).ok);
  fails(and(window(18, 18)), 'EMPTY_TIME_WINDOW', `${AT}.policy.root`);
  fails(
    window(18, 6),
    'UNDECLARED_CAPABILITY',
    `${AT}.policy.root.op`,
    { capability: 'schedule' },
    ['schedule@1'],
  );
});

// Astra A1. Breaks: a fact.assign value (any outcome) or a fact_compare value not of the fact's
// type installs although the compiler rejects its source (FACT_TYPE_MISMATCH), so a failed check
// faults at play time instead.
test("a recipe's or a policy's fact value outside its FactSpec is FACT_TYPE_MISMATCH", () => {
  const PICK = 'ashmere_dusk@0.0.1:recipe/pick_lock';
  const gate = {
    cartridge_id: 'ashmere_dusk',
    cartridge_version: '0.0.1',
    kind: 'fact',
    key: 'crypt_gate_open',
  };
  fails(
    (c) => {
      c.recipes[PICK].check.chance = 20;
      c.recipes[PICK].outcomes.failure.sequence = [{ op: 'fact.assign', fact: gate, value: 1 }];
    },
    'FACT_TYPE_MISMATCH',
    `.cartridge.recipes["${PICK}"].outcomes.failure.sequence[0].value`,
    {},
    [],
    'cartridge_dusk_hash.json',
  );
  fails(
    (c) => (recipe(c).policy.root.item.equals = 'rung'),
    'FACT_TYPE_MISMATCH',
    `${AT}.policy.root.item.equals`,
  );
});

// Review S2. Breaks: two recipes' checks with one key load, so one check DefinitionRef names two
// checks and a check_passed objective completes on either.
test("two recipes' checks with one key are DUPLICATE_DEFINITION", () => {
  const toll = 'ashmere_bell@0.0.1:recipe/toll_bell';
  fails(
    and((c) => (c.recipes[toll] = { ...structuredClone(recipe(c)), key: 'toll_bell' })),
    'DUPLICATE_DEFINITION',
    `${AT}.check`,
  );
});
