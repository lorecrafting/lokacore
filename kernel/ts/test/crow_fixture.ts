// bleed_sampler's frozen KAT (combat, death, population) with its hounds replaced by an inline
// D8 crow corridor (docs/system/mechanics.md, D8 crow scavenging): two crow slots homed in
// burrow (ordinary wander pair burrow/den) carry a dropped old_coin burrow -> den -> path into
// the lidded nest in path.
import { fragment } from './fragment.ts';

const f = fragment('protocol/fixtures/bleed_sampler_hash.json');
export const { prefix, ref } = f;
const at = (name: string) => ref('room', name);

function item(c: any, name: string, more: object) {
  c.items[`${prefix}:item/${name}`] = {
    key: name,
    keywords: [name],
    short: `item.${name}.short`,
    description: `item.${name}.description`,
    room_line: `item.${name}.room`,
    mass_grams: 10,
    ...more,
  };
  Object.assign(c.text, {
    [`item.${name}.short`]: `the ${name}`,
    [`item.${name}.description`]: `A ${name}.`,
    [`item.${name}.room`]: `A [${name}](${name}) lies here.`,
  });
}

function withCrow(c: any) {
  delete c.npcs[`${prefix}:npc/hound`];
  delete c.items[`${prefix}:item/fur`];
  c.lock.capabilities.barrier = c.manifest.requires.capabilities.barrier = 1;
  item(c, 'old_coin', { location: { in: 'room', room: at('burrow') } });
  item(c, 'crow_nest', {
    barrier: ref('barrier', 'crow_nest_lid'),
    capacity: 8,
    container: true,
    location: { in: 'room', room: at('path') },
    mass_grams: 250,
  });
  item(c, 'crow_corpse', { container: true, location: { in: 'template' }, mass_grams: 0 });
  c.barriers = {
    [`${prefix}:barrier/crow_nest_lid`]: {
      initial: 'open',
      key: 'crow_nest_lid',
      keywords: ['lid'],
      short: 'barrier.crow_nest_lid.short',
    },
  };
  c.npcs[`${prefix}:npc/crow`] = {
    attack: { chance: 0, damage_max: 1, damage_min: 1 },
    description: 'npc.crow.description',
    hp: { gain: 0, maximum: 1, minimum: 0, start: 1 },
    key: 'crow',
    keywords: ['crow'],
    room: at('burrow'),
    room_line: 'npc.crow.room',
    short: 'npc.crow.short',
    spawn_template: true,
  };
  c.populations = {};
  for (const slot of ['crow_1', 'crow_2'])
    c.populations[`${prefix}:population/${slot}`] = {
      area: [at('burrow'), at('den')],
      npc: ref('npc', 'crow'),
      corpse: ref('item', 'crow_corpse'),
      cap: 1,
      day_target: 1,
      home: at('burrow'),
      key: slot,
      night_end: 6,
      night_start: 20,
      night_target: 1,
      replacement_delay: 86400,
      wander_interval: 3600,
      scavenge: {
        corridor: [at('burrow'), at('den'), at('path')],
        drop_rooms: [at('burrow')],
        interval: 150,
        items: [ref('item', 'old_coin')],
        nest: ref('item', 'crow_nest'),
        narration: {
          acquired: 'narration.crow_acquired',
          carrying: 'npc.crow.carrying',
          delivered: 'narration.crow_delivered',
          fallback: 'narration.crow_fallback',
          shoo: 'narration.crow_shoo',
        },
      },
    };
  Object.assign(c.text, {
    'barrier.crow_nest_lid.short': "the nest's lid",
    'narration.crow_acquired': 'The crow picks up the old coin.',
    'narration.crow_delivered': 'The crow leaves the old coin in its nest.',
    'narration.crow_fallback': 'The crow drops the old coin here.',
    'narration.crow_shoo': 'The crow drops the old coin and flies off.',
    'npc.crow.carrying': 'The crow grips an old coin in its beak.',
    'npc.crow.description': 'A black crow picks its way along the ground.',
    'npc.crow.short': 'a crow',
    'npc.crow.room': 'A [crow](crow) watches the ground.',
  });
}

export const START = 43200;
// Noon in burrow, so both crows are present and awake.
const base = (c: any) => {
  withCrow(c);
  c.entry = at('burrow');
  c.calendar.start = START;
};
export const bundle = (change = (_: any) => {}) =>
  f.bundle((c) => {
    base(c);
    change(c);
  });
export const genesis = (change = (_: any) => {}) =>
  f.genesis((c) => {
    base(c);
    change(c);
  });
