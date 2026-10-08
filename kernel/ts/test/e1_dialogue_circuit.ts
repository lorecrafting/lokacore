// Fixed v042 training/social route: authored lessons, fares and ordinary conversations.
import assert from 'node:assert/strict';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import type { CaseHost } from './e1_case_host.ts';

export function dialogueCircuit(a: CaseHost) {
  const talk = (npc: string, dialogue: string, choice: string) => {
    a.invoke(dialogue, [a.entity('npc', npc)]);
    a.reopen();
    const pending = a.view().choice!.continuation_id;
    assert.equal(a.story.world().state.choices![pending]!.source.key, dialogue);
    a.choose(choice);
    a.reopen();
    assert.equal(a.view().choice, undefined);
  };
  const learn = (npc: string, skill: string) => {
    assert.equal(a.flag(`skill_${skill}`), false);
    talk(npc, `${npc}_${skill}`, 'learn');
    assert.equal(a.flag(`skill_${skill}`), true);
  };
  a.invoke('choose_ancestry', [], { ancestry: 'hill_folk' });
  for (const choice of ['directions', 'inn', 'wren']) talk('elspeth', 'elspeth', choice);
  a.move('north', 'west');
  learn('peg', 'haggle');
  a.move('east', 'east');
  talk('gareth', 'gareth', 'leave');
  a.move('west', 'north', 'north', 'west');
  talk('ada', 'ada', 'leave');
  a.move('east', 'east');
  learn('tobin', 'swords');
  assert.equal(
    a.story.world().state.containers[a.entity('item', 'rusty_sword')],
    a.story.world().body,
  );
  learn('tobin', 'dodge');
  a.move('west', 'north', 'north');
  for (const choice of ['bell', 'leave']) talk('aldric', 'b_aldric', choice);
  a.move('north');
  talk('ash', 'ash', 'leave');
  talk('hale', 'hale', 'leave');
  a.move('east');
  learn('wick', 'bandage');
  a.move('west', 'south', 'south', 'south', 'south', 'south', 'south', 'west', 'south', 'up');
  talk('hob', 'hob', 'leave');
  a.move('down', 'north');
  a.invoke('board_ferry', [a.detail('boathouse', 'ferry')], {
    route: {
      cartridge_id: 'ashmere_missing_child',
      cartridge_version: '0.0.42',
      kind: 'transport',
      key: 'fen_outbound',
    },
    quoted_fare: 2,
  });
  a.move('east');
  learn('sedge', 'herbalism');
  learn('sedge', 'swim');
  a.move('west');
  a.invoke('return_ferry', [a.detail('fen_isle_landing', 'ferry')], {
    route: {
      cartridge_id: 'ashmere_missing_child',
      cartridge_version: '0.0.42',
      kind: 'transport',
      key: 'fen_return',
    },
    quoted_fare: 0,
  });
  a.elapsed(144_000);
  a.move('east', 'south', 'south', 'south', 'south');
  talk('vesper', 'vesper', 'greet');
  talk('wren', 'wren', 'greet');
  const world = a.story.world(),
    pennies = resourceRef(world, 'pennies');
  assert.equal(level(world, world.body, pennies), 10);
  assert.equal(level(world, a.entity('npc', 'peg'), pennies), 22);
  assert.equal(level(world, a.entity('npc', 'tobin'), pennies), 4);
  assert.equal(level(world, a.entity('npc', 'sedge'), pennies), 4);
  assert.equal(a.view().place.title.key, 'room.fox_hollow.title');
  return { lessons: 6, pennies: 10, terminal_room: 'fox_hollow' };
}
