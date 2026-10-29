import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load, prefix } from './food_fixture.ts';
const apple = (c: any) => c.items[`${prefix}:item/apple_01`];
// Breaks: a zero edible amount or an equippable edible loads.
test('loader rejects impossible held-food declarations while retaining capped food', () => {
  const cases: [string, (c: any) => void, string, string][] = [
    ['zero', (c) => (apple(c).edible.amount = 0), 'SCHEMA_VIOLATION', 'edible.amount'],
    ['equipment', (c) => (apple(c).slot = 'hand'), 'SCHEMA_VIOLATION', '.slot'],
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
