import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load, prefix, ref } from './food_fixture.ts';
const apple = (c: any) => c.items[`${prefix}:item/apple_01`];
const mv = (c: any) => c.resources[`${prefix}:resource/mv`];
// Breaks: an edible binds unknown/non-recovery resources, conflicting holder features or an uninstalled food contract.
test('loader rejects impossible held-food declarations while retaining capped food', () => {
  const cases: [string, (c: any) => void, string, string][] = [
    ['zero', (c) => (apple(c).edible.amount = 0), 'SCHEMA_VIOLATION', 'edible.amount'],
    [
      'unknown',
      (c) => (apple(c).edible.resource = ref('resource', 'absent')),
      'SCHEMA_VIOLATION',
      'edible',
    ],
    [
      'HP',
      (c) => {
        apple(c).edible.resource = ref('resource', 'hp');
        c.resources[`${prefix}:resource/hp`].regen = mv(c).regen;
      },
      'SCHEMA_VIOLATION',
      'edible',
    ],
    [
      'no standing regen',
      (c) => (mv(c).regen.by_position.standing = 0),
      'SCHEMA_VIOLATION',
      'edible',
    ],
    ['container', (c) => (apple(c).container = true), 'SCHEMA_VIOLATION', 'edible'],
    ['equipment', (c) => (apple(c).slot = 'hand'), 'SCHEMA_VIOLATION', '.slot'],
    [
      'missing text',
      (c) => (apple(c).edible.narration = 'missing.line'),
      'UNRESOLVED_REFERENCE',
      'edible.narration',
    ],
    [
      'old API',
      (c) => (c.manifest.requires.kernel_api.at_least = '1.26'),
      'KERNEL_API_RANGE_INVALID',
      'kernel_api.at_least',
    ],
    [
      'undeclared',
      (c) => {
        delete c.lock.capabilities.food;
        delete c.manifest.requires.capabilities.food;
      },
      'UNDECLARED_CAPABILITY',
      'edible',
    ],
  ];
  for (const [name, change, code, path] of cases) {
    const r = load(change);
    assert.equal(r.ok, false, name);
    if (!r.ok) {
      assert.equal(r.diagnostic.code, code, name);
      assert.ok(r.diagnostic.path.endsWith(path), `${name}: ${r.diagnostic.path}`);
    }
  }
  assert.equal(load().ok, true);
});
