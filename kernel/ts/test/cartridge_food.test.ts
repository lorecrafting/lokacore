import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadCartridge, INSTALLED } from '../src/index.ts';
import { bundle, prefix, ref } from './food_fixture.ts';
// Breaks: an edible binds unknown/non-recovery resources, conflicting holder features or an uninstalled food contract.
test('loader rejects impossible held-food declarations while retaining capped food', () => {
  const cases: [string, (c: any) => void][] = [
    ['zero', (c) => (c.items[`${prefix}:item/apple_01`].edible.amount = 0)],
    [
      'unknown',
      (c) => (c.items[`${prefix}:item/apple_01`].edible.resource = ref('resource', 'absent')),
    ],
    [
      'HP',
      (c) => {
        c.items[`${prefix}:item/apple_01`].edible.resource = ref('resource', 'hp');
        c.resources[`${prefix}:resource/hp`].regen = c.resources[`${prefix}:resource/mv`].regen;
      },
    ],
    ['container', (c) => (c.items[`${prefix}:item/apple_01`].container = true)],
    ['equipment', (c) => (c.items[`${prefix}:item/apple_01`].slot = 'hand')],
    ['missing text', (c) => (c.items[`${prefix}:item/apple_01`].edible.narration = 'missing.line')],
    ['old API', (c) => (c.manifest.requires.kernel_api.at_least = '1.25')],
    [
      'undeclared',
      (c) => {
        delete c.lock.capabilities.food;
        delete c.manifest.requires.capabilities.food;
      },
    ],
  ];
  for (const [name, change] of cases) {
    const b = bundle(change);
    assert.equal(
      loadCartridge(
        new TextEncoder().encode(`{"cartridge":${b.canonical},"content_hash":"${b.sha256}"}`),
        INSTALLED,
      ).ok,
      false,
      name,
    );
  }
  const b = bundle();
  assert.equal(
    loadCartridge(
      new TextEncoder().encode(`{"cartridge":${b.canonical},"content_hash":"${b.sha256}"}`),
      INSTALLED,
    ).ok,
    true,
  );
});
