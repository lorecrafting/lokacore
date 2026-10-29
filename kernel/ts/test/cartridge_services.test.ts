import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load, prefix, ref } from './service_fixture.ts';
const meal = (c: any) => c.services[`${prefix}:service/kitchen_meal`];
const room = (c: any) => c.services[`${prefix}:service/kitchen_room`];
const drink = (c: any) => c.services[`${prefix}:service/kitchen_ale`];
const cook = (c: any) => c.npcs[`${prefix}:npc/cook`];
const cask = (c: any) => c.items[`${prefix}:item/kitchen_cask`];
const bedPaid = (c: any) => c.facts[`${prefix}:fact/bed_paid`];
const S = 'SCHEMA_VIOLATION';
// Breaks: a typed service names unbound/nonfinite funding or stock, an arbitrary effect/recovery pool, or forged provider declarations.
// The showcase's own claim service and shop also bind pennies, so currency cases that fail there are not isolated and are left out.
test('loader refuses service bindings that cannot produce exact immediate outcomes', () => {
  assert.equal(load().ok, true);
  const cases: [string, (c: any) => void, string, string][] = [
    [
      'regenerating stock',
      (c) => (c.resources[`${prefix}:resource/meal_stock`].gain = 1),
      S,
      'kitchen_meal"].benefit.stock',
    ],
    [
      'missing stock',
      (c) => delete cook(c).resource_starts.meal_stock,
      S,
      'kitchen_meal"].benefit.stock',
    ],
    [
      'currency is stock',
      (c) => (meal(c).benefit.stock = ref('resource', 'pennies')),
      S,
      'kitchen_meal"].benefit.stock',
    ],
    [
      'HP bonus',
      (c) => (meal(c).benefit.recovery = ref('resource', 'hp')),
      S,
      'kitchen_meal"].benefit.recovery',
    ],
    [
      'unknown stock',
      (c) => (meal(c).benefit.stock = ref('resource', 'missing')),
      S,
      'kitchen_meal"].benefit.stock',
    ],
    ['wrong provider', (c) => (meal(c).provider = ref('npc', 'hob')), S, 'npc/cook"].services'],
    [
      'duplicate references',
      (c) => cook(c).services.push(ref('service', 'kitchen_room')),
      S,
      'npc/cook"].services',
    ],
    [
      'foreign cask',
      (c) => (cask(c).location.npc = ref('npc', 'hob')),
      S,
      'kitchen_ale"].benefit.vessel',
    ],
    [
      'ground cask',
      (c) => (cask(c).location = { in: 'room', room: ref('room', 'farm_kitchen') }),
      S,
      'kitchen_ale"].benefit.vessel',
    ],
    [
      'wrong liquid',
      (c) => (drink(c).benefit.liquid = ref('liquid', 'water')),
      S,
      'kitchen_ale"].benefit.vessel',
    ],
    [
      'incomplete serving',
      (c) => (c.liquids[`${prefix}:liquid/draught`].drink_amount = 5),
      S,
      'kitchen_ale"].benefit.vessel',
    ],
    [
      'instance entitlement',
      (c) => (bedPaid(c).scopes = ['instance']),
      S,
      'kitchen_room"].benefit.fact',
    ],
    [
      'prepaid default',
      (c) => (bedPaid(c).value_type.default = true),
      S,
      'kitchen_room"].benefit.fact',
    ],
    [
      'wrong command',
      (c) => (c.actions[`${prefix}:action/eat_kitchen_meal`].command = 'look'),
      S,
      'kitchen_meal"].action',
    ],
    [
      'missing narration',
      (c) => (room(c).narration = 'unknown.line'),
      'UNRESOLVED_REFERENCE',
      'kitchen_room"].narration',
    ],
    [
      'old API',
      (c) => (c.manifest.requires.kernel_api.at_least = '1.22'),
      'KERNEL_API_RANGE_INVALID',
      'kernel_api.at_least',
    ],
  ];
  for (const [name, change, code, suffix] of cases) {
    const r = load(change) as any;
    assert.equal(r.ok, false, name);
    assert.equal(r.diagnostic.code, code, name);
    assert.ok(r.diagnostic.path.endsWith(suffix), `${name}: ${r.diagnostic.path}`);
  }
});
