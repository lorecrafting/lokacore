// Fixed v042 item round; prices and holders come from cartridges/ashmere_missing_child/{npcs/peg,items/*}.json.
import assert from 'node:assert/strict';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import type { CaseHost } from './e1_case_host.ts';

export function itemRound(a: CaseHost) {
  a.invoke('choose_ancestry', [], { ancestry: 'fen_born' }); // swim, no haggle discount
  a.move('north', 'west');
  const peg = a.entity('npc', 'peg'),
    item = (key: string) => a.entity('item', key),
    pennies = () => {
      const world = a.story.world();
      return level(world, world.body, resourceRef(world, 'pennies'));
    },
    trade = (verb: 'buy' | 'sell', key: string, quoted_price: number) =>
      a.invoke(verb, [peg, item(key)], { quoted_price });
  trade('buy', 'torch', 3); // pool_bottom is dark; its chest is out of reach unlit
  a.invoke('ignite', [item('torch')]);
  trade('buy', 'satchel', 5);
  trade('buy', 'iron_sword', 8);
  trade('buy', 'wooden_shield', 4);
  trade('sell', 'iron_sword', 4);
  trade('sell', 'satchel', 2);
  trade('sell', 'wooden_shield', 2);
  trade('buy', 'lamp_oil', 2);
  trade('buy', 'waterskin', 4);
  trade('sell', 'waterskin', 2);
  trade('buy', 'spare_waterskin', 4);
  assert.equal(pennies(), 0);

  a.move('east', 'east', 'up');
  a.invoke('take', [item('brass_key')]);
  a.move('up');
  const trunk = item('trunk');
  a.invoke('unlock', [trunk]);
  a.invoke('open', [trunk]);
  a.invoke('take', [item('tin_whistle')]);
  a.reopen();

  a.move('down', 'down', 'west', 'south', 'south', 'south', 'south', 'south', 'west', 'down');
  assert.equal(a.view().place.title.key, 'room.pool_bottom.title');
  a.invoke('take', [item('silver_ring')]);
  a.move('up');
  a.reopen();
  const world = a.story.world(),
    held = ['torch', 'lamp_oil', 'spare_waterskin', 'brass_key', 'tin_whistle', 'silver_ring'],
    sold = ['iron_sword', 'satchel', 'wooden_shield', 'waterskin'];
  for (const key of held) assert.equal(world.state.containers[item(key)], world.body, key);
  for (const key of sold) assert.equal(world.state.containers[item(key)], peg, key);
  return { held, sold, pennies: pennies() };
}
