import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { loadCartridge } from '../src/content/cartridge.ts';
import { INSTALLED } from '../src/runtime/world.ts';
import { read } from './read.ts';

const ID = 'ashmere_items@0.0.1';
const ref = (kind: string, key: string) => ({
  cartridge_id: 'ashmere_items',
  cartridge_version: '0.0.1',
  kind,
  key,
});
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
const load = (change: (c: any) => void = () => {}) => {
  const c = structuredClone(read('protocol/fixtures/containers_cartridge_items_hash.json').value);
  c.manifest.requires.kernel_api.at_least = '1.19';
  c.manifest.requires.capabilities.liquid = c.lock.capabilities.liquid = 1;
  c.liquids = {
    [`${ID}:liquid/water`]: {
      key: 'water',
      label: 'water.label',
      unit_label: 'water.units',
      grams_per_unit: 250,
      drink_amount: 1,
    },
  };
  Object.assign(c.text, { 'water.label': 'Water', 'water.units': 'units' });
  Object.assign(c.items[`${ID}:item/lantern`], {
    mass_grams: 500,
    vessel: {
      capacity: 4,
      unit_label: 'water.units',
      initial: { kind: ref('liquid', 'water'), quantity: 2 },
    },
  });
  c.rooms[`${ID}:room/ferry_landing`].details.mooring_post.liquid_source = ref('liquid', 'water');
  change(c);
  const bytes = JSON.stringify(sorted(c));
  return loadCartridge(
    new TextEncoder().encode(
      JSON.stringify({
        cartridge: c,
        content_hash: createHash('sha256').update(bytes).digest('hex'),
      }),
    ),
    INSTALLED,
  );
};
const item = (c: any) => c.items[`${ID}:item/lantern`];
const liquid = (c: any) => c.liquids[`${ID}:liquid/water`];

// Breaks: reference validation, initial consistency, maximum fill mass or opt-in gates are omitted.
test('loader validates opted liquid metadata and accepts exact maximum mass', () => {
  assert.ok(load().ok);
  assert.ok(load((c) => (item(c).mass_grams = 2147482647)).ok);
  assert.ok(load((c) => (item(c).vessel.initial = { kind: null, quantity: 0 })).ok);
  for (const [name, change, code] of [
    ['null positive', (c: any) => (item(c).vessel.initial.kind = null), 'SCHEMA_VIOLATION'],
    ['kind zero', (c: any) => (item(c).vessel.initial.quantity = 0), 'SCHEMA_VIOLATION'],
    ['overcapacity', (c: any) => (item(c).vessel.initial.quantity = 5), 'SCHEMA_VIOLATION'],
    [
      'unknown kind',
      (c: any) => (item(c).vessel.initial.kind.key = 'missing'),
      'UNRESOLVED_REFERENCE',
    ],
    ['wrong kind', (c: any) => (item(c).vessel.initial.kind.kind = 'item'), 'UNRESOLVED_REFERENCE'],
    ['missing mass', (c: any) => delete item(c).mass_grams, 'SCHEMA_VIOLATION'],
    ['maximum fill', (c: any) => (item(c).mass_grams = 2147482648), 'SCHEMA_VIOLATION'],
    [
      'unsafe product',
      (c: any) => {
        item(c).vessel.capacity = 2147483647;
        liquid(c).grams_per_unit = 2147483647;
      },
      'SCHEMA_VIOLATION',
    ],
    [
      'missing unit',
      (c: any) => (item(c).vessel.unit_label = 'missing.units'),
      'UNRESOLVED_REFERENCE',
    ],
    ['missing label', (c: any) => (liquid(c).label = 'missing.label'), 'UNRESOLVED_REFERENCE'],
    ['zero density', (c: any) => (liquid(c).grams_per_unit = 0), 'SCHEMA_VIOLATION'],
    ['zero drink', (c: any) => (liquid(c).drink_amount = 0), 'SCHEMA_VIOLATION'],
    [
      'unknown source',
      (c: any) =>
        (c.rooms[`${ID}:room/ferry_landing`].details.mooring_post.liquid_source.key = 'missing'),
      'UNRESOLVED_REFERENCE',
    ],
    ['item source', (c: any) => (item(c).liquid_source = ref('liquid', 'water')), 'UNKNOWN_FIELD'],
    ['map key', (c: any) => (liquid(c).key = 'oil'), 'ARTIFACT_DEFINITION_KEY_MISMATCH'],
    [
      'old API',
      (c: any) => (c.manifest.requires.kernel_api.at_least = '1.18'),
      'KERNEL_API_RANGE_INVALID',
    ],
    [
      'missing capability',
      (c: any) => {
        delete c.lock.capabilities.liquid;
        delete c.manifest.requires.capabilities.liquid;
      },
      'UNDECLARED_CAPABILITY',
    ],
  ] as const) {
    const result = load(change);
    assert.ok(!result.ok, name);
    if (!result.ok) assert.equal(result.diagnostic.code, code, name);
  }
});
