// The loader's capability locks for recipes, their checks and resources (R5 S5; recipes.ex checks
// the recipes themselves). Mutants of the bell and hello known
// answers are re-hashed with node:crypto over sorted-key JSON.stringify (the canonical form for
// these values), never by the kernel; expected diagnostics are hand-written.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { loadCartridge } from '../src/content/cartridge.ts';
import { INSTALLED } from '../src/runtime/world.ts';
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
const RECIPE = 'recipe_sampler@0.0.1:recipe/ring_bell';
const AT = `.cartridge.recipes["${RECIPE}"]`;
const recipe = (c: any) => c.recipes[RECIPE];
const success = (c: any) => recipe(c).outcomes.success;

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

// Breaks: a failure outcome's step or a check loads without its owner (fact@1, check@1) locked.
test("a failure outcome's and the check's owners are checked", () => {
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

// Breaks: a time_window node loads without schedule@1 locked.
test('time_window needs schedule@1', () => {
  const window = (from: number, to: number) => (c: any) =>
    (recipe(c).policy.root = { op: 'time_window', from, to });
  assert.ok(load('cartridge_bell_hash.json', and(window(18, 6))).ok);
  const unscheduled = (c: any) => {
    delete c.manifest.requires.capabilities.schedule; // the compiler adds it with the pools
    delete c.lock.capabilities.schedule;
    window(18, 6)(c);
  };
  fails(unscheduled, 'UNDECLARED_CAPABILITY', `${AT}.policy.root.op`, { capability: 'schedule' }, [
    'schedule@1',
  ]);
});

// R5 S6b resources, on the road known answer.
const ROAD = 'cartridge_road_hash.json';
const HP = 'resource_sampler@0.0.1:resource/hp';
const road_fails = (f: (c: any) => void, code: string, path: string, data = {}, s: string[] = []) =>
  fails(f, code, path, data, s, ROAD);

test('resources without resource@1 in the lock are UNDECLARED_CAPABILITY', () => {
  road_fails(
    (c) => {
      delete c.manifest.requires.capabilities.resource;
      delete c.lock.capabilities.resource;
    },
    'UNDECLARED_CAPABILITY',
    `.cartridge.resources["${HP}"]`,
    { capability: 'resource' },
    ['resource@1'],
  );
});
