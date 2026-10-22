// Water fragment: the frozen cellar_sampler KAT (death, combat, carry 12000, hp 10/mv 100,
// calendar 64800, trunk, chapel shrine) plus an inline swim skill, two water routes and their loot.
import type { World } from '../src/index.ts';
import { fragment } from './fragment.ts';

const f = fragment('protocol/fixtures/cartridge_sampler_hash.json');
export const { ref, prefix } = f;
export const entity = (w: World, kind: string, name: string) =>
  w.entityIds[`${prefix}:${kind}/${name}`];
export const room = (w: World, name: string) => w.roomIds[`${prefix}:room/${name}`];

const text = (c: any, entries: Record<string, string>) => Object.assign(c.text, entries);
const to = (key: string) => ({ to: ref('room', key) });
function addRoom(c: any, key: string, exits: object, dark = false) {
  c.rooms[`${prefix}:room/${key}`] = {
    key,
    title: `room.${key}.title`,
    description: `room.${key}.description`,
    ...(dark ? { dark_description: `room.${key}.dark` } : {}),
    exits,
  };
  const title = key.replace(/(^|_)(\w)/g, (_, gap, ch) => (gap && ' ') + ch.toUpperCase());
  text(c, { [`room.${key}.title`]: title, [`room.${key}.description`]: `The ${key}.` });
  if (dark) text(c, { [`room.${key}.dark`]: 'Black water.' });
}
function addItem(c: any, key: string, location: object, extra: object = {}) {
  c.items[`${prefix}:item/${key}`] = {
    key,
    keywords: [key],
    short: `item.${key}.short`,
    description: `item.${key}.description`,
    room_line: `item.${key}.room`,
    location,
    mass_grams: 10,
    ...extra,
  };
  text(c, {
    [`item.${key}.short`]: key,
    [`item.${key}.description`]: `A ${key}.`,
    [`item.${key}.room`]: `A ${key} is here.`,
  });
}
const inRoom = (key: string) => ({ in: 'room', room: ref('room', key) });

export function waterSource(c: any) {
  for (const cap of ['water', 'skills', 'light']) {
    c.lock.capabilities[cap] = 1;
    c.manifest.requires.capabilities[cap] = 1;
  }
  c.manifest.requires.kernel_api.at_least = '1.37';
  c.entry = ref('room', 'well_shaft');
  c.resources[`${prefix}:resource/mv`].start = 10;
  c.rooms[`${prefix}:room/well_lane`].exits.down = to('well_shaft');
  addRoom(c, 'well_shaft', { up: to('well_lane'), down: to('well_bottom') });
  addRoom(c, 'well_bottom', { up: to('well_shaft') }, true);
  addRoom(c, 'black_pool', { west: to('ferry_landing'), down: to('pool_bottom') });
  addRoom(c, 'pool_bottom', { up: to('black_pool') }, true);
  addRoom(c, 'isle_hut', { east: to('ferry_landing') });
  c.rooms[`${prefix}:room/ferry_landing`].exits.east = to('black_pool');
  c.rooms[`${prefix}:room/ferry_landing`].exits.west = to('isle_hut');
  c.skills = {
    [`${prefix}:skill/swim`]: {
      key: 'swim',
      label: 'skill.swim.label',
      requirement: 'skill.swim.requirement',
      qualification: { policy_version: 1, root: { op: 'all', items: [] } },
    },
  };
  text(c, { 'skill.swim.label': 'Swim', 'skill.swim.requirement': 'Learn to swim.' });
  c.facts[`${prefix}:fact/skill_swim`] = {
    key: 'skill_swim',
    version: 1,
    value_type: { type: 'bool', default: false },
    scopes: ['player'],
    meaning: "Skill swim's acquisition (skills@1): only skills@1 writes it.",
  };
  c.world.water = {
    skill: ref('skill', 'swim'),
    maximum_grams: 6000,
    entry_cost: 10,
    duration: 6000,
    warning: 'water.warning',
    drowned: 'water.drowned',
    routes: [
      { surface: ref('room', 'well_shaft'), bottom: ref('room', 'well_bottom') },
      { surface: ref('room', 'black_pool'), bottom: ref('room', 'pool_bottom') },
    ],
  };
  text(c, {
    'water.warning': 'Your lungs burn.',
    'water.drowned': 'You drown.',
    'action.recover_corpse': 'Recover belongings',
    'item.recovered': 'You recover',
  });
  const trunk = c.items[`${prefix}:item/trunk`];
  Object.assign(trunk, { container: true, mass_grams: 5000, location: inRoom('well_shaft') });
  c.items[`${prefix}:item/brass_key`].location = inRoom('well_shaft');
  // Newer kernel_api floors require corpse templates and lidded items to be declared containers.
  for (const k of ['player_corpse', 'rat_corpse', 'storage_chest'])
    c.items[`${prefix}:item/${k}`].container = true;
  c.barriers[`${prefix}:barrier/trunk_lid`].initial = 'open';
  addItem(c, 'lamp_oil', inRoom('well_lane'), {
    fuel: { kind: 'supply', unit: 'oil', capacity: 7200, initial: 7200 },
  });
  addItem(
    c,
    'torch',
    { in: 'item', item: ref('item', 'trunk') },
    {
      mass_grams: 100,
      slot: 'light',
      fuel: {
        kind: 'source',
        unit: 'oil',
        capacity: 7200,
        initial: 7200,
        rate: 1,
        supply: ref('item', 'lamp_oil'),
        ignited: 'light.ignited',
        doused: 'light.doused',
        refueled: 'light.refueled',
      },
    },
  );
  text(c, { 'light.ignited': 'Lit.', 'light.doused': 'Out.', 'light.refueled': 'Full.' });
  addItem(c, 'old_coin', inRoom('well_bottom'));
  addItem(c, 'sunken_chest', inRoom('pool_bottom'), {
    container: true,
    capacity: 1,
    mass_grams: 2000,
  });
  addItem(c, 'silver_ring', { in: 'item', item: ref('item', 'sunken_chest') }, { mass_grams: 5 });
  c.npcs[`${prefix}:npc/sedge`] = {
    key: 'sedge',
    keywords: ['sedge'],
    short: 'npc.sedge.short',
    description: 'npc.sedge.description',
    room_line: 'npc.sedge.room',
    room: ref('room', 'well_shaft'),
  };
  c.dialogues[`${prefix}:dialogue/sedge_swim`] = {
    key: 'sedge_swim',
    npc: ref('npc', 'sedge'),
    label: 'sedge.swim.choice',
    prompt: 'sedge.swim.prompt',
    roles: { teacher: { role: 'npc', npc: ref('npc', 'sedge') } },
    policy: {
      policy_version: 1,
      root: { op: 'fact_compare', fact: ref('fact', 'skill_swim'), equals: false },
    },
    choices: {
      learn: {
        label: 'sedge.swim.choice',
        narration: 'sedge.swim.learned',
        sequence: [{ op: 'skill.acquire', skill: ref('skill', 'swim') }],
      },
    },
  };
  text(c, {
    'sedge.swim.choice': 'Learn to swim',
    'sedge.swim.prompt': 'Sedge offers a lesson.',
    'sedge.swim.learned': 'You can swim.',
    'npc.sedge.short': 'Sedge',
    'npc.sedge.description': 'A swimmer.',
    'npc.sedge.room': 'Sedge is here.',
  });
}
const withWater =
  (change: (c: any) => void = () => {}) =>
  (c: any) => {
    waterSource(c);
    change(c);
  };
export const bundle = (change?: (c: any) => void) => f.bundle(withWater(change));
export const genesis = (change?: (c: any) => void) => f.genesis(withWater(change));
export const fresh = genesis;
