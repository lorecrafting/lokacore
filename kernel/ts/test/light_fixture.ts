// Light fixture: the frozen cellar_sampler KAT (containers migration) plus inline light, commerce and detail content.
// Every asserted fuel, price and room value below comes from this file, not from a compiler run.
import { fragment } from './fragment.ts';
import type { EntityId } from '../src/contracts.gen.ts';

export const f = fragment('protocol/fixtures/containers_cartridge_sampler_hash.json');
const { ref, prefix } = f;
const id = (kind: string, key: string) => `${prefix}:${kind}/${key}`;
const shown = (kind: string, key: string) => ({
  keywords: [key],
  short: `${kind}.${key}.short`,
  room_line: `${kind}.${key}.room`,
  description: `${kind}.${key}.description`,
});
const atPeg = { in: 'npc', npc: ref('npc', 'peg') };

/** Chapter-shaped light world: Peg's shop west of Well Lane, the dark Well Shaft below it. */
export function light(c: any) {
  for (const cap of ['light', 'commerce', 'inspectable_detail']) {
    c.manifest.requires.capabilities[cap] = 1;
    c.lock.capabilities[cap] = 1;
  }
  c.manifest.requires.kernel_api.at_least = '1.19';
  c.resources[id('resource', 'pennies')] = {
    key: 'pennies',
    minimum: 0,
    maximum: 1000,
    start: 20,
    gain: 0,
  };
  c.rooms[id('room', 'well_lane')].exits.west = { to: ref('room', 'chandler') };
  c.rooms[id('room', 'well_lane')].exits.down = { to: ref('room', 'well_shaft') };
  c.rooms[id('room', 'chandler')] = {
    key: 'chandler',
    title: 'room.chandler.title',
    description: 'room.chandler.description',
    exits: { east: { to: ref('room', 'well_lane') } },
  };
  c.rooms[id('room', 'well_shaft')] = {
    key: 'well_shaft',
    title: 'room.well_shaft.title',
    description: 'room.well_shaft.description',
    dark_description: 'room.well_shaft.dark',
    details: {
      masonry: { aliases: ['masonry', 'stonework'], description: 'detail.masonry.description' },
    },
    exits: { up: { to: ref('room', 'well_lane') } },
  };
  c.npcs[id('npc', 'peg')] = {
    key: 'peg',
    ...shown('npc', 'peg'),
    room: ref('room', 'chandler'),
    resource_starts: { pennies: 20 },
    shop: {
      resource: ref('resource', 'pennies'),
      offers: [
        { item: ref('item', 'torch'), buy: 3, sell: 1 },
        { item: ref('item', 'lamp_oil'), buy: 2, sell: 1 },
        { item: ref('item', 'satchel'), buy: 5, sell: 2 },
      ],
      bought: 'shop.bought',
      sold: 'shop.sold',
    },
  };
  c.npcs[id('npc', 'aldric')] = {
    key: 'aldric',
    ...shown('npc', 'aldric'),
    keywords: ['aldric', 'prior'],
    room: ref('room', 'chapel_nave'),
    resource_starts: { pennies: 10 },
  };
  c.items[id('item', 'torch')] = {
    key: 'torch',
    ...shown('item', 'torch'),
    mass_grams: 100,
    location: atPeg,
    slot: 'light',
    fuel: {
      kind: 'source',
      capacity: 7200,
      initial: 7200,
      rate: 1,
      unit: 'oil',
      supply: ref('item', 'lamp_oil'),
      ignited: 'light.ignited',
      doused: 'light.doused',
      refueled: 'light.refueled',
    },
  };
  c.items[id('item', 'lamp_oil')] = {
    key: 'lamp_oil',
    ...shown('item', 'lamp_oil'),
    keywords: ['lamp_oil', 'oil'],
    mass_grams: 200,
    location: atPeg,
    fuel: { kind: 'supply', capacity: 7200, initial: 7200, unit: 'oil' },
  };
  c.items[id('item', 'satchel')] = {
    key: 'satchel',
    ...shown('item', 'satchel'),
    mass_grams: 100,
    location: atPeg,
    container: true,
    capacity: 4,
  };
  Object.assign(c.text, {
    'action.ignite': 'Ignite',
    'action.douse': 'Douse',
    'action.refuel': 'Refuel',
    'light.ignited': 'You light the torch.',
    'light.doused': 'You douse the torch.',
    'light.refueled': 'You refill the torch.',
    'shop.bought': 'You buy it.',
    'shop.sold': 'You sell it.',
    'room.chandler.title': 'Chandler',
    'room.chandler.description': 'A chandler shop.',
    'room.well_shaft.title': 'Well Shaft',
    'room.well_shaft.description': 'A stone shaft.',
    'room.well_shaft.dark': 'Darkness fills the shaft.',
    'detail.masonry.description': 'Fitted stones.',
  });
  for (const [kind, key] of [
    ['npc', 'peg'],
    ['npc', 'aldric'],
    ['item', 'torch'],
    ['item', 'lamp_oil'],
    ['item', 'satchel'],
  ])
    for (const part of ['short', 'room', 'description']) c.text[`${kind}.${key}.${part}`] = key;
  c.text['item.torch.short'] = 'a torch';
  c.text['item.lamp_oil.short'] = 'a flask of lamp oil';
}

export const bundle = f.bundle(light);
export const fresh = f.genesis(light);
export const entity = (name: string) => fresh.entityIds[id('item', name)] as EntityId;
export const npc = (name: string) => fresh.entityIds[id('npc', name)] as EntityId;
export const room = (name: string) => fresh.roomIds[id('room', name)] as EntityId;

/** Controlled lethal producer in the dark shaft; its kill credits no fact. */
export function lethalLightFixture() {
  const change = (c: any) => {
    light(c);
    const rat = c.npcs[id('npc', 'cellar_rat_1')];
    rat.room = ref('room', 'well_shaft');
    rat.attack = { chance: 100, damage_min: 10, damage_max: 10 };
    c.world.death_credit = c.world.death_credit.filter((r: any) => r.npc.key !== 'cellar_rat_1');
  };
  return { bundle: f.bundle(change), fresh: f.genesis(change) };
}

/** Light without commerce: the frozen items sampler lantern with a small oil supply. */
export function lightOnlyFixture() {
  const g = fragment('protocol/fixtures/containers_cartridge_items_hash.json');
  const change = (c: any) => {
    c.manifest.time_policy = { profile: 'real_elapsed', rate: 50 };
    c.manifest.requires.kernel_api.at_least = '1.19';
    for (const cap of ['light', 'calendar']) {
      c.manifest.requires.capabilities[cap] = 1;
      c.lock.capabilities[cap] = 1;
    }
    c.calendar = { start: 100 };
    c.items[`${g.prefix}:item/satchel`].container = true;
    c.items[`${g.prefix}:item/lantern`].fuel = {
      kind: 'source',
      capacity: 8,
      initial: 2,
      rate: 1,
      unit: 'oil',
      supply: g.ref('item', 'lamp_oil'),
      ignited: 'light.ignited',
      doused: 'light.doused',
      refueled: 'light.refueled',
    };
    c.items[`${g.prefix}:item/lamp_oil`].fuel = {
      kind: 'supply',
      capacity: 6,
      initial: 6,
      unit: 'oil',
    };
    c.text['light.ignited'] = 'You light the lantern.';
    c.text['light.doused'] = 'You douse the lantern.';
    c.text['light.refueled'] = 'You refill the lantern.';
  };
  return { bundle: g.bundle(change), fresh: g.genesis(change) };
}

/** Schema-valid authored aliases keep independent action identities and contracts. */
export function lightActionFixture(
  key: string,
  command: string,
  target: object,
  input: string[] = [],
) {
  return f.genesis((c) => {
    light(c);
    c.actions[id('action', key)] = {
      key,
      command,
      label: `action.${command}`,
      accessibility: `action.${command}`,
      target,
      input,
      priority: 1,
      policy: { op: 'all', items: [] },
    };
    c.text[`action.${command}`] ??= command;
  });
}
