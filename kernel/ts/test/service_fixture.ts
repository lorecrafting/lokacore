// Controlled service worlds over the frozen toolbox_showcase KAT. The meal, drink and room services,
// their stock, vessel and fact are inline: no frozen KAT carries those kinds, and every asserted
// number (price, amount, balance, stock) is set here, never read from showcase content.
import { fragment } from './fragment.ts';
import { level } from '../src/mechanics/resource.ts';
import { key } from '../src/foundation/compose.ts';
import { step, type World } from '../src/index.ts';
import type { Command } from '../src/contracts.gen.ts';

const f = fragment('protocol/fixtures/toolbox_showcase_hash.json');
export const { prefix, ref } = f;
const rk = (kind: string, name: string) => `${prefix}:${kind}/${name}`;
function base(c: any) {
  c.entry = ref('room', 'farm_kitchen');
  c.calendar.start = 0;
  c.resources[rk('resource', 'mv')].start = 50;
  c.resources[rk('resource', 'pennies')].start = 20;
  c.resources[rk('resource', 'meal_stock')] = {
    gain: 0,
    key: 'meal_stock',
    maximum: 4,
    minimum: 0,
    start: 0,
  };
  c.facts[rk('fact', 'bed_paid')] = {
    key: 'bed_paid',
    meaning: 'The player paid the cook for the bed.',
    scopes: ['player'],
    value_type: { default: false, type: 'bool' },
    version: 1,
  };
  c.text['service.full_mv'] = 'Your MV is full.';
  c.text['service.sold_out'] = 'Sold out.';
  const cask = structuredClone(c.items[rk('item', 'cask')]);
  c.items[rk('item', 'kitchen_cask')] = {
    ...cask,
    key: 'kitchen_cask',
    keywords: ['kitchen_cask'],
    location: { in: 'npc', npc: ref('npc', 'cook') },
    vessel: {
      capacity: 4,
      initial: { kind: ref('liquid', 'draught'), quantity: 4 },
      unit_label: 'liquid.doses',
    },
  };
  const cook = c.npcs[rk('npc', 'cook')];
  cook.resource_starts = { pennies: 10, meal_stock: 4 };
  const open = { op: 'all', items: [] };
  const services: [string, string, object][] = [
    [
      'kitchen_meal',
      'eat_kitchen_meal',
      {
        benefit: {
          amount: 12,
          debit: 1,
          kind: 'meal',
          recovery: ref('resource', 'mv'),
          stock: ref('resource', 'meal_stock'),
        },
        price: 2,
      },
    ],
    [
      'kitchen_ale',
      'drink_kitchen_ale',
      {
        benefit: {
          amount: 4,
          kind: 'drink',
          liquid: ref('liquid', 'draught'),
          recovery: ref('resource', 'mv'),
          vessel: ref('item', 'kitchen_cask'),
        },
        price: 1,
      },
    ],
    [
      'kitchen_room',
      'rent_kitchen_room',
      { benefit: { fact: ref('fact', 'bed_paid'), kind: 'entitlement' }, price: 3 },
    ],
  ];
  for (const [name, action, rest] of services) {
    c.text[`service.${name}`] = name;
    c.text[`service.${name}.used`] = `${name} used`;
    c.actions[rk('action', action)] = {
      accessibility: `service.${name}`,
      command: 'use_service',
      input: ['service', 'quoted_price'],
      key: action,
      label: `service.${name}`,
      policy: open,
      priority: 0,
      target: { kind: 'entity', scopes: ['room_occupants'] },
    };
    c.services[rk('service', name)] = {
      action,
      currency: ref('resource', 'pennies'),
      key: name,
      label: `service.${name}`,
      narration: `service.${name}.used`,
      provider: ref('npc', 'cook'),
      ...rest,
    };
    cook.services.push(ref('service', name));
  }
}
const with_base = (change: (c: any) => void) => (c: any) => {
  base(c);
  change(c);
};
export const bundle = (change: (c: any) => void = () => {}) => f.bundle(with_base(change));
export const load = (change: (c: any) => void = () => {}) => f.load(with_base(change));
export function fresh(change: (c: any) => void = () => {}) {
  const world = f.genesis(with_base(change));
  return { ...world, state: world.state as any };
}
export const entity = (w: World, kind: string, name: string) =>
  w.entityIds[`${prefix}:${kind}/${name}`];
export const resourceKey = (w: World, holder: string, name: string) =>
  key({ kind: 'resource', resource: ref('resource', name), entity_id: holder });
export const amounts = (w: World) =>
  [w.body, entity(w, 'npc', 'cook')].map(
    (id) => w.state.resources![resourceKey(w, id, 'pennies')].value,
  );
export const mv = (w: World) => level(w, w.body, ref('resource', 'mv'))!;
export const stock = (w: World) =>
  w.state.resources![resourceKey(w, entity(w, 'npc', 'cook'), 'meal_stock')].value;
export const ale = (w: World) => w.state.liquids![entity(w, 'item', 'kitchen_cask')];
export function run(w: World, name: string, ordinal = 1, change: object = {}) {
  const s = w.cartridge.services![`${prefix}:service/${name}`];
  return step(
    w,
    {
      id: `aaaaaaaa-0000-4000-8000-${String(ordinal).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: {
        type: 'use_service',
        actor_id: w.character,
        provider_id: entity(w, 'npc', 'cook'),
        service: ref('service', name),
        quoted_price: s.price,
        ...change,
      },
    } as Command,
    ordinal,
    s.action,
  );
}
// A world whose only history-bearing content is the room-rental service: no liquids, vessels, quests,
// exchanges or patrols, so the service guard alone must refuse an unearned entitlement.
export function onlyService(c: any) {
  const keep = (o: any, names: string[]) =>
    Object.fromEntries(Object.entries<any>(o).filter(([, v]) => names.includes(v.key)));
  for (const section of [
    'quests',
    'reactions',
    'dialogues',
    'story_points',
    'scenes',
    'skills',
    'topics',
    'liquids',
    'populations',
    'barriers',
    'attributes',
    'recipes',
    'replenish',
    'statuses',
    'items',
  ])
    c[section] = {};
  for (const section of ['alternates', 'speech', 'structures', 'map_positions']) delete c[section];
  c.world = { carry: { max_grams: 12000 } };
  c.facts = keep(c.facts, ['position', 'bed_paid']);
  c.actions = keep(c.actions, ['rent_kitchen_room']);
  c.services = keep(c.services, ['kitchen_room']);
  c.resources = keep(c.resources, ['hp', 'mv', 'pennies']);
  const cook = c.npcs[rk('npc', 'cook')];
  cook.services = [ref('service', 'kitchen_room')];
  cook.resource_starts = { pennies: 10 };
  c.npcs = { [rk('npc', 'cook')]: cook };
  const kitchen = c.rooms[rk('room', 'farm_kitchen')];
  c.rooms = { [rk('room', 'farm_kitchen')]: { ...kitchen, exits: {} } };
}
