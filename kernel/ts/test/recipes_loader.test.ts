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
