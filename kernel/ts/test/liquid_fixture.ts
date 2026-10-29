// Liquid fixture: the light fixture's shop world plus two waterskins at Peg and a well in Well Lane.
// Every asserted volume, price and mass comes from this file, not from a compiler run.
import { f, light } from './light_fixture.ts';

const { ref, prefix } = f;
export const id = (kind: string, key: string) => `${prefix}:${kind}/${key}`;
const skin = (key: string, keywords: string[]) => ({
  key,
  keywords,
  name: `item.${key}.short`,
  room_line: `item.${key}.room`,
  description: `item.${key}.description`,
  mass_grams: 500,
  location: { in: 'npc', npc: ref('npc', 'peg') },
  vessel: { capacity: 4, unit_label: 'liquid.units', initial: { kind: null, quantity: 0 } },
});

function liquid(c: any) {
  light(c);
  for (const cap of ['liquid', 'readable']) {
    c.manifest.requires.capabilities[cap] = 1;
    c.lock.capabilities[cap] = 1;
  }
  c.manifest.requires.kernel_api.at_least = '1.20';
  c.liquids = {
    [id('liquid', 'water')]: {
      key: 'water',
      name: 'liquid.water',
      unit_label: 'liquid.units',
      grams_per_unit: 250,
      drink_amount: 1,
    },
  };
  c.items[id('item', 'waterskin')] = skin('waterskin', ['waterskin']);
  c.items[id('item', 'spare_waterskin')] = skin('spare_waterskin', ['spare', 'waterskin', 'skin']);
  c.items[id('item', 'tithe_ledger')] = {
    key: 'tithe_ledger',
    keywords: ['ledger'],
    name: 'item.tithe_ledger.short',
    room_line: 'item.tithe_ledger.room',
    description: 'item.tithe_ledger.description',
    mass_grams: 200,
    location: { in: 'npc', npc: ref('npc', 'peg') },
  };
  c.npcs[id('npc', 'peg')].shop.offers.push(
    { item: ref('item', 'waterskin'), buy: 4, sell: 2 },
    { item: ref('item', 'spare_waterskin'), buy: 4, sell: 2 },
  );
  c.rooms[id('room', 'well_lane')].details = {
    well: {
      aliases: ['well', 'water'],
      description: 'detail.well.description',
      liquid_source: ref('liquid', 'water'),
      readable: {
        title: 'detail.well.title',
        label: 'detail.well.read',
        text: 'detail.well.description',
      },
    },
  };
  Object.assign(c.text, {
    'liquid.water': 'Water',
    'liquid.units': 'quarter-litres',
    'liquid.empty': 'Empty',
    'liquid.filled': 'You fill the skin.',
    'liquid.drank': 'You drink.',
    'liquid.poured': 'You pour.',
    'action.fill': 'Fill',
    'action.pour': 'Pour',
    'action.drink': 'Drink',
    'detail.well.description': 'A well.',
    'detail.well.title': 'The well',
    'detail.well.read': 'Examine the well',
    'item.waterskin.short': 'a waterskin',
    'item.spare_waterskin.short': 'a spare waterskin',
  });
  for (const key of ['waterskin', 'spare_waterskin', 'tithe_ledger'])
    for (const part of ['short', 'room', 'description']) c.text[`item.${key}.${part}`] ??= key;
}

export const liquidBundle = (change: (c: any) => void = () => {}) =>
  f.bundle((c) => {
    liquid(c);
    change(c);
  });
export const liquidFresh = () => f.genesis(liquid);
