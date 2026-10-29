// The loader on items and NPCs (R5 S4; protocol/cartridge.schema.json DiagnosticCode). Mutants
// of the items known answer (protocol/fixtures/containers_cartridge_items_hash.json) are re-hashed with
// node:crypto over sorted-key JSON.stringify (the canonical form for these values), never by
// the kernel; expected diagnostics are hand-written.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { loadCartridge } from '../src/content/cartridge.ts';
import { INSTALLED } from '../src/runtime/world.ts';
import { read } from './read.ts';
import { validate } from '../src/foundation/validate.ts';

const kat = read('protocol/fixtures/containers_cartridge_items_hash.json');
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
const load = (f: (c: any) => void, installed = INSTALLED) => {
  const c = structuredClone(kat.value);
  f(c);
  const text = JSON.stringify(sorted(c));
  const hash = createHash('sha256').update(text).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${hash}"}`),
    installed,
  );
};
const fails = (
  f: (c: any) => void,
  code: string,
  path: string,
  data = {},
  suggested: string[] = [],
) =>
  assert.deepEqual(load(f), {
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
const ID = 'items_sampler@0.0.1';
const item = (key: string) => `.cartridge.items["${ID}:item/${key}"]`;
const at = (c: any, key: string) => c.items[`${ID}:item/${key}`];

// Breaks: items or NPCs rejected, or hashed other than the Python known answer.
test('the items known answer loads', () => {
  const r = load(() => {});
  assert.ok(r.ok);
  assert.equal(r.hash, kat.sha256);
});

// Breaks: an item map key that disagrees with its item loads.
test('item map keys match their keys', () => {
  fails(
    (c) => (at(c, 'lantern').key = 'lamp'),
    'ARTIFACT_DEFINITION_KEY_MISMATCH',
    item('lantern'),
    { field: 'key', declared: 'lantern', expected: 'lamp' },
  );
});

const carryingContent = (c: any) => {
  c.world = { carry: { max_grams: 0 } };
  c.manifest.requires.kernel_api.at_least = '1.3';
  for (const item of Object.values(c.items) as any[]) item.mass_grams = 0;
};

// Breaks: malformed mass/carry values or unknown fields bypass the cartridge boundary.
test('carrying loader and validator reject malformed numbers and fields', () => {
  for (const [value, error] of [
    [-1, 'below_minimum'],
    [2147483648, 'above_maximum'],
    ['0', 'invalid_type'],
  ] as const)
    fails(
      (c) => {
        carryingContent(c);
        at(c, 'lantern').mass_grams = value;
      },
      'SCHEMA_VIOLATION',
      `${item('lantern')}.mass_grams`,
      { error },
    );
  fails(
    (c) => {
      carryingContent(c);
      c.world.carry.max_grams = -1;
    },
    'SCHEMA_VIOLATION',
    '.cartridge.world.carry.max_grams',
    { error: 'below_minimum' },
  );
  for (const value of [0.5, 9007199254740992])
    fails(
      (c) => {
        carryingContent(c);
        c.world.carry.max_grams = value;
      },
      'INVALID_JSON',
      '',
    );
  assert.deepEqual(validate('GameError', { code: 'too_heavy' }), []);
  assert.deepEqual(validate('WorldSettings', { carry: { max_grams: 9007199254740991 } }), []);
  assert.deepEqual(validate('WorldSettings', { carry: { max_grams: 9007199254740992 } }), [
    { path: '/carry/max_grams', code: 'invalid_type' },
  ]);
  assert.deepEqual(validate('WorldSettings', { carry: { max_grams: 0, extra: 0 } }), [
    { path: '/carry/extra', code: 'unknown_property' },
  ]);
  assert.deepEqual(validate('WorldSettings', { carry: {} }), [
    { path: '/carry/max_grams', code: 'missing_property' },
  ]);
});

// Breaks: opting in permits an older installed implementation.
test('carrying loader requires an installed API 1.3', () => {
  const old = load(carryingContent, { ...INSTALLED, kernel_api: '1.2' });
  assert.ok(!old.ok);
  if (!old.ok)
    assert.deepEqual(
      [old.diagnostic.code, old.diagnostic.path, old.diagnostic.data],
      ['KERNEL_API_UNSUPPORTED', '.cartridge.manifest.requires.kernel_api', { installed: '1.2' }],
    );
});

// Breaks: a required item property, occupancy/mass bound, closed shape or authority literal
// disappears. Shared literal cases also run through the compiler's portable validator.
test('item schema enforces its required fields, bounds and literal container authority', () => {
  for (const row of read('protocol/fixtures/container_contracts.json'))
    assert.equal(validate('ItemDefinition', row.value).length === 0, row.valid, row.name);
});

// Breaks: authored name words on an item and an NPC are refused (loka-6qi; the shape is
// container_contracts.json rows, the catalog keys the compiler's).
test('name words load at 1.118', () => {
  const worded = (c: any) => {
    c.manifest.requires.kernel_api.at_least = '1.118';
    at(c, 'lantern').words = {
      bare: 'item.lantern.short',
      article: 'a',
      plural: 'item.lantern.room',
    };
    c.npcs[`${ID}:npc/bram`].words = { bare: 'npc.bram.short' };
  };
  assert.equal(load(worded).ok, true);
});
