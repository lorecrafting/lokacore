// Fixed v042 route answers, checked against the authored reciprocal exits and ferry fares.
import assert from 'node:assert/strict';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import type { CaseHost } from './e1_case_host.ts';

export const ROUTE_ROOMS = [
  'adder_nest',
  'belfry',
  'bell_tower',
  'black_pool',
  'boathouse',
  'chandler',
  'chandler_storeroom',
  'chapel_nave',
  'chapel_steps',
  'cloister',
  'cottage_loft',
  'drowned_lantern',
  'drowned_oak',
  'east_gate',
  'elspeth_cottage',
  'empty_cottage',
  'fen_isle_landing',
  'ferry_landing',
  'fishing_shallows',
  'fox_den_deep',
  'fox_hollow',
  'gate_tower',
  'herb_garden',
  'hound_run',
  'hut_loft',
  'infirmary',
  'inn_attic',
  'inn_rooms',
  'isle_hut',
  'isle_shrine',
  'kitchen_garden',
  'lantern_cellar',
  'marsh_light',
  'mill_cellar',
  'mill_loft',
  'mire_crossing',
  'north_gate',
  'oak_branches',
  'oak_crown',
  'old_causeway',
  'old_mill',
  'orchard',
  'pool_bottom',
  'prior_study',
  'reed_bank',
  'reed_path',
  'scriptorium',
  'smithy',
  'spire',
  'tide_flats',
  'village_green',
  'watch_cell',
  'watch_post',
  'well_bottom',
  'well_lane',
  'well_shaft',
  'willow_shade',
] as const;

export function topology(a: CaseHost) {
  const place = (room: string) => assert.equal(a.view().place.title.key, `room.${room}.title`);
  const walk = (steps: readonly (readonly [string, string])[]) => {
    for (const [direction, room] of steps) {
      a.move(direction);
      place(room);
    }
  };
  const ferry = (
    room: string,
    action: string,
    route: string,
    fare: number,
    destination: string,
  ) => {
    a.invoke(action, [a.detail(room, 'ferry')], {
      route: {
        cartridge_id: 'ashmere_missing_child',
        cartridge_version: '0.0.42',
        kind: 'transport',
        key: route,
      },
      quoted_fare: fare,
    });
    place(destination);
    a.reopen();
    place(destination);
    const world = a.story.world();
    assert.equal(level(world, world.body, resourceRef(world, 'pennies')), 18);
    assert.equal(level(world, a.entity('npc', 'sedge'), resourceRef(world, 'pennies')), 2);
  };
  place('ferry_landing');
  a.invoke('choose_ancestry', [], { ancestry: 'hill_folk' });
  walk([['west', 'boathouse']]);
  ferry('boathouse', 'board_ferry', 'fen_outbound', 2, 'fen_isle_landing');
  walk([['east', 'isle_hut']]);
  a.invoke('sedge_swim', [a.entity('npc', 'sedge')]);
  a.reopen();
  a.choose('learn');
  assert.equal(a.flag('skill_swim'), true);
  walk([
    ['up', 'hut_loft'],
    ['down', 'isle_hut'],
    ['east', 'herb_garden'],
    ['west', 'isle_hut'],
    ['west', 'fen_isle_landing'],
    ['south', 'isle_shrine'],
    ['north', 'fen_isle_landing'],
  ]);
  ferry('fen_isle_landing', 'return_ferry', 'fen_return', 0, 'boathouse');
  walk([
    ['south', 'old_mill'],
    ['up', 'mill_loft'],
    ['down', 'old_mill'],
    ['down', 'mill_cellar'],
    ['up', 'old_mill'],
    ['south', 'empty_cottage'],
    ['up', 'cottage_loft'],
    ['down', 'empty_cottage'],
    ['north', 'old_mill'],
    ['north', 'boathouse'],
    ['east', 'ferry_landing'],
    ['north', 'well_lane'],
    ['west', 'chandler'],
    ['down', 'chandler_storeroom'],
    ['up', 'chandler'],
    ['east', 'well_lane'],
    ['east', 'drowned_lantern'],
    ['up', 'inn_rooms'],
    ['up', 'inn_attic'],
    ['down', 'inn_rooms'],
    ['down', 'drowned_lantern'],
    ['down', 'lantern_cellar'],
    ['up', 'drowned_lantern'],
    ['west', 'well_lane'],
    ['down', 'well_shaft'],
    ['down', 'well_bottom'],
  ]);
  a.reopen(); // The underwater save must load before its free surface consumer.
  walk([
    ['up', 'well_shaft'],
    ['up', 'well_lane'],
    ['north', 'village_green'],
    ['east', 'east_gate'],
    ['west', 'village_green'],
    ['west', 'smithy'],
    ['west', 'orchard'],
    ['east', 'smithy'],
    ['east', 'village_green'],
    ['north', 'north_gate'],
    ['west', 'elspeth_cottage'],
    ['east', 'north_gate'],
    ['east', 'watch_post'],
    ['east', 'watch_cell'],
    ['west', 'watch_post'],
    ['up', 'gate_tower'],
    ['down', 'watch_post'],
    ['west', 'north_gate'],
    ['north', 'chapel_steps'],
    ['north', 'chapel_nave'],
    ['west', 'prior_study'],
    ['east', 'chapel_nave'],
    ['up', 'bell_tower'],
    ['up', 'belfry'],
    ['up', 'spire'],
    ['down', 'belfry'],
    ['down', 'bell_tower'],
    ['down', 'chapel_nave'],
    ['north', 'cloister'],
    ['east', 'infirmary'],
    ['west', 'cloister'],
    ['west', 'scriptorium'],
    ['west', 'kitchen_garden'],
    ['east', 'scriptorium'],
    ['east', 'cloister'],
    ['south', 'chapel_nave'],
  ]);
  // Trusted elapsed input replenishes movement before the marsh circuit.
  a.elapsed(144_000);
  assert.equal(a.story.world().state.clock, 72000);
  a.reopen();
  walk([
    ['south', 'chapel_steps'],
    ['south', 'north_gate'],
    ['south', 'village_green'],
    ['south', 'well_lane'],
    ['south', 'ferry_landing'],
    ['south', 'reed_path'],
    ['south', 'reed_bank'],
    ['east', 'hound_run'],
    ['east', 'adder_nest'],
    ['west', 'hound_run'],
    ['west', 'reed_bank'],
    ['west', 'willow_shade'],
    ['south', 'drowned_oak'],
    ['up', 'oak_branches'],
    ['up', 'oak_crown'],
    ['down', 'oak_branches'],
    ['down', 'drowned_oak'],
    ['south', 'black_pool'],
    ['south', 'fishing_shallows'],
    ['north', 'black_pool'],
    ['down', 'pool_bottom'],
  ]);
  a.reopen();
  walk([
    ['up', 'black_pool'],
    ['east', 'fox_hollow'],
    ['down', 'fox_den_deep'],
    ['up', 'fox_hollow'],
    ['north', 'mire_crossing'],
    ['east', 'marsh_light'],
    ['south', 'old_causeway'],
    ['east', 'tide_flats'],
    ['west', 'old_causeway'],
    ['north', 'marsh_light'],
    ['west', 'mire_crossing'],
    ['north', 'reed_bank'],
    ['north', 'reed_path'],
    ['north', 'ferry_landing'],
  ]);
  a.reopen();
  place('ferry_landing');
  assert.deepEqual([...a.seen.rooms].sort(), [...ROUTE_ROOMS]);
  return {
    rooms: [...a.seen.rooms].sort(),
    terminal_room: 'ferry_landing',
    swim: a.flag('skill_swim'),
    fares: { fen_outbound: 2, fen_return: 0 },
  };
}
