// Controlled clocks/locations use the actual compiled chapter; release pins remain provisional.
import {
  bundle as sourceBundle,
  fresh as sourceFresh,
  genesis as sourceGenesis,
  ref,
  prefix,
} from './transport_fixture.ts';
export { ref, prefix, room, entity } from './transport_fixture.ts';
export function waterSource(c: any) {
  c.entry = ref('room', 'well_shaft');
  c.calendar.start = 64800;
  delete c.rooms[`${prefix}:room/well_shaft`].dark_description;
  c.resources[`${prefix}:resource/mv`].start = 10;
  // The fixture relocates the existing teacher and possessions to avoid unrelated route setup.
  c.npcs[`${prefix}:npc/sedge`].room = ref('room', 'well_shaft');
  c.items[`${prefix}:item/trunk`].location = { in: 'room', room: ref('room', 'well_shaft') };
  c.items[`${prefix}:item/trunk`].mass_grams = 5000;
  c.items[`${prefix}:item/torch`].location = { in: 'item', item: ref('item', 'trunk') };
  c.items[`${prefix}:item/brass_key`].location = { in: 'room', room: ref('room', 'well_shaft') };
  c.npcs[`${prefix}:npc/peg`].shop.offers = c.npcs[`${prefix}:npc/peg`].shop.offers.filter(
    (o: any) => o.item.key !== 'torch',
  );
  c.barriers[`${prefix}:barrier/trunk_lid`].initial = 'open';
}
export const bundle = (change: (c: any) => void = () => {}) =>
  sourceBundle((c) => {
    waterSource(c);
    change(c);
  });
export const fresh = (change: (c: any) => void = () => {}) =>
  sourceFresh((c) => {
    waterSource(c);
    change(c);
  });

export const genesis = (change: (c: any) => void = () => {}) =>
  sourceGenesis((c) => {
    waterSource(c);
    change(c);
  });
