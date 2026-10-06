import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INSTALLED, loadCartridge } from '../src/index.ts';
import { bundle, prefix, ref } from './service_fixture.ts';
const load = (change: (c: any) => void = () => {}) => {
  const b = bundle(change);
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${b.canonical},"content_hash":"${b.sha256}"}`),
    INSTALLED,
  );
};
// Breaks: a typed service names unbound/nonfinite funding or stock, an arbitrary effect/recovery pool, or forged provider declarations.
test('loader refuses service bindings that cannot produce exact immediate outcomes', () => {
  assert.equal(load().ok, true);
  const meal = (c: any) => c.services[`${prefix}:service/lantern_meal`],
    room = (c: any) => c.services[`${prefix}:service/lantern_room`],
    drink = (c: any) => c.services[`${prefix}:service/lantern_ale`],
    maud = (c: any) => c.npcs[`${prefix}:npc/maud`],
    cask = (c: any) => c.items[`${prefix}:item/lantern_ale_cask`];
  for (const [name, change] of [
    ['missing balance', (c: any) => delete maud(c).resource_starts.pennies],
    ['regenerating currency', (c: any) => (c.resources[`${prefix}:resource/pennies`].gain = 1)],
    ['regenerating stock', (c: any) => (c.resources[`${prefix}:resource/lantern_meals`].gain = 1)],
    ['missing stock', (c: any) => delete maud(c).resource_starts.lantern_meals],
    ['currency is stock', (c: any) => (meal(c).benefit.stock = ref('resource', 'pennies'))],
    ['HP bonus', (c: any) => (meal(c).benefit.recovery = ref('resource', 'hp'))],
    ['unknown stock', (c: any) => (meal(c).benefit.stock = ref('resource', 'missing'))],
    ['wrong provider', (c: any) => (meal(c).provider = ref('npc', 'peg'))],
    ['duplicate references', (c: any) => maud(c).services.push(ref('service', 'lantern_room'))],
    ['foreign cask', (c: any) => (cask(c).location.npc = ref('npc', 'peg'))],
    [
      'ground cask',
      (c: any) => (cask(c).location = { in: 'room', room: ref('room', 'drowned_lantern') }),
    ],
    ['wrong liquid', (c: any) => (drink(c).benefit.liquid = ref('liquid', 'water'))],
    ['incomplete serving', (c: any) => (c.liquids[`${prefix}:liquid/ale`].drink_amount = 5)],
    [
      'instance entitlement',
      (c: any) => (c.facts[`${prefix}:fact/lantern_bed_paid`].scopes = ['instance']),
    ],
    [
      'prepaid default',
      (c: any) => (c.facts[`${prefix}:fact/lantern_bed_paid`].value_type.default = true),
    ],
    [
      'wrong command',
      (c: any) => (c.actions[`${prefix}:action/eat_lantern_meal`].command = 'look'),
    ],
    ['missing narration', (c: any) => (room(c).narration = 'unknown.line')],
    [
      'unpaid entitlement writer',
      (c: any) =>
        (c.dialogues[`${prefix}:dialogue/maud_offer`].choices.accept.sequence = [
          { op: 'fact.assign', fact: ref('fact', 'lantern_bed_paid'), value: true },
        ]),
    ],
    ['old API', (c: any) => (c.manifest.requires.kernel_api.at_least = '1.22')],
  ] as const)
    assert.equal(load(change).ok, false, name);
});
