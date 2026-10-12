// Economy and ecology ledger (cartridge.md "Economy and ecology ledger"; kernel/ts/play/ledger.ts)
// on a hand-written cartridge literal holding only the fields the tool reads. The expected ledger
// is hand-derived from the literal.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ledger } from '../play/ledger.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';

const R = (kind: string, key: string) => ({ cartridge_id: 'f', cartridge_version: '1', kind, key });
const defs = (kind: string, d: Obj) =>
  Object.fromEntries(Object.entries(d).map(([k, v]) => [`f@1:${kind}/${k}`, v]));
const S = (kind: string, key: string) => `f@1:${kind}/${key}`;
const coins = (amount: number) => ({ resource: R('resource', 'pennies'), amount });

const fixture = {
  manifest: { id: 'f', version: '1' },
  world: { movement: { cost: { resource: R('resource', 'pennies'), amount: 1 } } },
  resources: defs('resource', {
    pennies: { key: 'pennies', start: 5, maximum: 50, gain: 0 },
    mv: { key: 'mv', start: 10, maximum: 10, gain: 1 },
  }),
  npcs: defs('npc', {
    shopkeep: {
      resource_starts: { pennies: 7 },
      shop: {
        resource: R('resource', 'pennies'),
        // candle is authored after torch and sorts before it
        offers: [
          { item: R('item', 'torch'), buy: 3, sell: 1 },
          { item: R('item', 'candle'), buy: 2, sell: 1 },
        ],
        buy_discount: { numerator: 9, denominator: 10, minimum: 1 },
      },
    },
    innkeep: { resource_starts: { pennies: 2, lantern_meals: 4 } },
    teacher: { resource_starts: { pennies: 0 } },
    aldric: { resource_starts: { pennies: 10 } },
    ferryman: { resource_starts: { pennies: 0 } },
    rat: { drops: [{ item: R('item', 'tail'), chance: 50 }] },
  }),
  services: defs('service', {
    meal: {
      currency: R('resource', 'pennies'),
      price: 2,
      provider: R('npc', 'innkeep'),
      benefit: { kind: 'meal', stock: R('resource', 'lantern_meals') },
    },
  }),
  transports: defs('transport', {
    ferry: { currency: R('resource', 'pennies'), fare: 2, recipient: R('npc', 'ferryman') },
  }),
  dialogues: defs('dialogue', {
    lesson: {
      roles: {
        master: { role: 'npc', npc: R('npc', 'teacher') },
        gift: { role: 'item', item: R('item', 'sword') },
      },
      choices: {
        learn: {
          lesson_payment: { to: 'master', ...coins(2) },
          receive: { from: 'master', item: 'gift' },
        },
      },
    },
    debt: {
      roles: {
        patron: { role: 'npc', npc: R('npc', 'aldric') },
        book: { role: 'item', item: R('item', 'ledger') },
      },
      choices: {
        paid: {
          payment: { from: 'patron', ...coins(10) },
          availability: { through: 3600 },
          hand_over: { item: 'book', to: 'patron' },
        },
      },
    },
  }),
  items: defs('item', {
    apple: { edible: { resource: R('resource', 'mv'), amount: 5 } },
  }),
  populations: defs('population', {
    hounds: {
      bundle: R('population_bundle', 'hounds'),
      home: R('room', 'kennel'),
      area: [R('room', 'kennel'), R('room', 'moor')],
      cap: 3,
      day_target: 2,
      night_target: 3,
      replacement_delay: 86400,
    },
  }),
  population_bundles: defs('population_bundle', {
    hounds: { npc: R('npc', 'hound'), item: R('item', 'pelt'), corpse: R('item', 'carcass') },
  }),
  rooms: defs('room', {
    glade: {
      details: {
        patch: {
          harvest: {
            items: [R('item', 'herb1'), R('item', 'herb2'), R('item', 'herb3')],
            tool: { tag: 'sharp' },
            careful: { count: 2 },
          },
        },
      },
    },
  }),
};

// Breaks: supply without the player start; a role key as the NPC; the lesson as a faucet; the
// stock read by the currency key; unclassified listing classified paths or nothing; the bundle
// item dropped; the seam counting `careful` as its items; rows left in artifact order (no item key).
test('ledger lists the currencies, money and item sites, populations and seams', () => {
  const pennies = S('resource', 'pennies');
  assert.deepEqual(ledger(fixture), {
    currencies: [
      {
        resource: pennies,
        player_start: 5,
        maximum: 50,
        purses: {
          [S('npc', 'aldric')]: 10,
          [S('npc', 'ferryman')]: 0,
          [S('npc', 'innkeep')]: 2,
          [S('npc', 'shopkeep')]: 7,
          [S('npc', 'teacher')]: 0,
        },
        supply: 24,
      },
    ],
    coins: {
      faucets: [
        {
          site: 'payment',
          ref: S('dialogue', 'debt'),
          choice: 'paid',
          npc: S('npc', 'aldric'),
          resource: pennies,
          amount: 10,
          through: 3600,
        },
        {
          site: 'shop_sell',
          ref: S('npc', 'shopkeep'),
          item: S('item', 'candle'),
          resource: pennies,
          amount: 1,
        },
        {
          site: 'shop_sell',
          ref: S('npc', 'shopkeep'),
          item: S('item', 'torch'),
          resource: pennies,
          amount: 1,
        },
      ],
      sinks: [
        {
          site: 'lesson',
          ref: S('dialogue', 'lesson'),
          choice: 'learn',
          npc: S('npc', 'teacher'),
          resource: pennies,
          amount: 2,
        },
        {
          site: 'service',
          ref: S('service', 'meal'),
          npc: S('npc', 'innkeep'),
          resource: pennies,
          amount: 2,
          stock: 4,
        },
        {
          site: 'shop_buy',
          ref: S('npc', 'shopkeep'),
          item: S('item', 'candle'),
          resource: pennies,
          amount: 2,
          buy_discount: { numerator: 9, denominator: 10, minimum: 1 },
        },
        {
          site: 'shop_buy',
          ref: S('npc', 'shopkeep'),
          item: S('item', 'torch'),
          resource: pennies,
          amount: 3,
          buy_discount: { numerator: 9, denominator: 10, minimum: 1 },
        },
        {
          site: 'transport',
          ref: S('transport', 'ferry'),
          npc: S('npc', 'ferryman'),
          resource: pennies,
          amount: 2,
        },
      ],
      unclassified: [{ from: 'world', path: '.movement.cost.resource', resource: pennies }],
    },
    items: {
      faucets: [
        { site: 'drop', ref: S('npc', 'rat'), item: S('item', 'tail'), chance: 50 },
        {
          site: 'receive',
          ref: S('dialogue', 'lesson'),
          choice: 'learn',
          item: S('item', 'sword'),
          npc: S('npc', 'teacher'),
        },
      ],
      sinks: [
        { site: 'edible', ref: S('item', 'apple'), resource: S('resource', 'mv'), amount: 5 },
        {
          site: 'hand_over',
          ref: S('dialogue', 'debt'),
          choice: 'paid',
          item: S('item', 'ledger'),
          npc: S('npc', 'aldric'),
        },
      ],
    },
    ecology: {
      populations: [
        {
          ref: S('population', 'hounds'),
          home: S('room', 'kennel'),
          area: [S('room', 'kennel'), S('room', 'moor')],
          cap: 3,
          day_target: 2,
          night_target: 3,
          replacement_delay: 86400,
          npc: S('npc', 'hound'),
          item: S('item', 'pelt'),
          corpse: S('item', 'carcass'),
        },
      ],
      seams: [{ room: S('room', 'glade'), detail: 'patch', items: 3, tool: 'sharp', careful: 2 }],
    },
  });
});

// Break (toolbox row 9): an encounter plan's row drops its `chance`.
test('an encounter plan row carries its chance', () => {
  const hounds = { ...fixture.populations[S('population', 'hounds')], chance: 25 };
  const populations = { [S('population', 'hounds')]: hounds };
  const [row] = ledger({ ...fixture, populations } as Obj).ecology.populations;
  assert.equal(row!.chance, 25);
});
