// Fixed v042 service circuit; literal prices, stock and recovery come from cartridge.md.
import assert from 'node:assert/strict';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import type { EntityId } from '../src/contracts.gen.ts';
import type { CaseHost } from './e1_case_host.ts';

export function lanternServices(a: CaseHost) {
  a.invoke('choose_ancestry', [], { ancestry: 'road_born' });
  a.move('north', 'east');
  const maud = a.entity('npc', 'maud');
  const amount = (holder: EntityId, name: string) => {
    const world = a.story.world();
    return level(world, holder, resourceRef(world, name));
  };
  const service = (key: string) => ({
    cartridge_id: 'ashmere_missing_child',
    cartridge_version: '0.0.42',
    kind: 'service',
    key,
  });
  const buy = (action: string, key: string, quoted_price: number) =>
    a.invoke(action, [maud], { service: service(key), quoted_price });

  buy('rent_lantern_room', 'lantern_room', 3);
  assert.equal(amount(a.story.world().body, 'pennies'), 17);
  assert.equal(amount(maud, 'pennies'), 13);
  assert.equal(a.flag('lantern_bed_paid'), true);

  buy('eat_lantern_meal', 'lantern_meal', 2);
  assert.equal(amount(a.story.world().body, 'pennies'), 15);
  assert.equal(amount(maud, 'pennies'), 15);
  assert.equal(amount(maud, 'lantern_meals'), 3);
  assert.equal(amount(a.story.world().body, 'mv'), 100);

  a.move('west', 'east', 'west', 'east');
  assert.equal(amount(a.story.world().body, 'mv'), 96);
  buy('drink_lantern_ale', 'lantern_ale', 1);
  assert.equal(amount(a.story.world().body, 'pennies'), 14);
  assert.equal(amount(maud, 'pennies'), 16);
  assert.equal(amount(a.story.world().body, 'mv'), 100);
  assert.equal(a.story.world().state.liquids?.[a.entity('item', 'lantern_ale_cask')]?.quantity, 3);
  a.reopen();
  assert.equal(amount(a.story.world().body, 'pennies'), 14);
  assert.equal(amount(maud, 'pennies'), 16);
  return { services: ['lantern_room', 'lantern_meal', 'lantern_ale'], pennies: 14, ale: 3 };
}
