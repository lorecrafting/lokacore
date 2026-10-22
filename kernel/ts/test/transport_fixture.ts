// fast_travel_sampler's frozen KAT (docs/system/mechanics.md fast travel, toolbox row 32).
import { key } from '../src/foundation/compose.ts';
import type { World } from '../src/index.ts';
import { fragment } from './fragment.ts';

const f = fragment('protocol/fixtures/fast_travel_sampler_hash.json');
export const { prefix, ref, bundle, genesis } = f;

// bleed_sampler's frozen combat and death blocks (corpses, position fact)
// grafted on, shrine south_post: recovery corpses need them.
const bleed = fragment('protocol/fixtures/bleed_sampler_hash.json');
const from = (kind: string, name: string) =>
  bleed.source[`${kind}s`][`${bleed.prefix}:${kind}/${name}`];
export const armed = (c: any) => {
  for (const k of ['combat', 'death', 'fact', 'position'])
    c.lock.capabilities[k] = c.manifest.requires.capabilities[k] = 1;
  c.world = {
    combat: bleed.source.world.combat,
    death: {
      npc_corpse: ref('item', 'npc_corpse'),
      player_corpse: ref('item', 'player_corpse'),
      restore: { hp: 10, mv: 82 },
      shrine: ref('room', 'south_post'),
    },
  };
  c.facts = { [`${prefix}:fact/position`]: from('fact', 'position') };
  c.items = {
    [`${prefix}:item/npc_corpse`]: from('item', 'npc_corpse'),
    [`${prefix}:item/player_corpse`]: from('item', 'player_corpse'),
  };
  for (const [k, v] of Object.entries(bleed.source.text))
    if (/^(combat\.|item\.(npc|player)_corpse|npc\.hound)/.test(k)) c.text[k] = v;
};
// bleed_sampler's hound, without its bleed hit, at north_post: an encounter at the boarding detail.
export const hound = (c: any) => {
  armed(c);
  const { attack, spawn_template, ...npc } = from('npc', 'hound');
  const { on_positive_hit, ...hit } = attack;
  c.npcs[`${prefix}:npc/hound`] = { ...npc, attack: hit, room: ref('room', 'north_post') };
};

// Rides are offered only after the destination was visited; transport tests open that gate.
export const open = (c: any) => {
  for (const a of ['ride_south', 'ride_north'])
    c.actions[`${prefix}:action/${a}`].policy = {
      policy_version: 1,
      root: { op: 'all', items: [] },
    };
};
export const entity = (w: World, kind: string, name: string) =>
  w.entityIds[`${prefix}:${kind}/${name}`];
export const room = (w: World, name: string) => w.roomIds[`${prefix}:room/${name}`];
export const endpoint = (w: World, route: string) =>
  Object.entries(w.details).find(
    ([, d]) => d.transport?.route.key === route,
  )![0] as keyof World['details'];
// [player body, carter]
export const coins = (w: World) =>
  [w.body, entity(w, 'npc', 'carter')].map(
    (id) =>
      w.state.resources![
        key({ kind: 'resource', entity_id: id, resource: ref('resource', 'coins') })
      ].value,
  );
