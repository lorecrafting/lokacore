// Fixed v042 Maud route; literal answers from cartridge.md Maud's Cellar.
import assert from 'node:assert/strict';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import type { CaseHost } from './e1_case_host.ts';

export function maudsCellar(a: CaseHost) {
  a.invoke('choose_ancestry', [], { ancestry: 'road_born' });
  a.move('north', 'east');
  const maud = a.entity('npc', 'maud'),
    key = a.entity('item', 'cellar_key'),
    quest = () =>
      Object.values(a.story.world().state.quests ?? {}).find(
        (q) => q.quest.key === 'mauds_cellar',
      )!;
  assert.equal(a.story.world().state.containers[key], maud);
  assert.equal(a.flag('maud_trust'), 0);
  a.invoke('maud_offer', [maud]);
  a.choose('accept');
  a.reopen();
  assert.equal(quest().state, 'active');
  a.move('down');
  assert.equal(a.view().place.title.key, 'room.lantern_cellar.title');

  for (let rat = 1; rat <= 5; rat++) {
    const killed = `rat_${rat}_killed`;
    assert.equal(a.flag(killed), false);
    a.invoke('attack', [a.entity('npc', `cellar_rat_${rat}`)]);
    for (let round = 0; round < 40 && !a.flag(killed); round++) a.elapsed(3_000);
    assert.equal(a.flag(killed), true, `distinct rat ${rat} must earn death credit`);
    a.reopen();
    assert.equal(a.flag(killed), true);
    assert.equal(a.story.world().state.containers[key], maud);
    if (rat < 5) {
      a.elapsed(144_000);
      a.reopen();
      const world = a.story.world();
      assert.equal(level(world, world.body, resourceRef(world, 'hp')), 10);
    }
  }
  assert.equal(quest().state, 'active');
  assert.equal(a.flag('inn_cellar_cleared'), false);
  a.move('up');
  a.invoke('maud_turn_in', [maud]);
  a.reopen();
  assert.equal(a.story.world().state.containers[key], maud);
  a.choose('done');
  a.reopen();
  assert.equal(quest().state, 'resolved');
  assert.equal(quest().outcome, 'done');
  assert.equal(a.story.world().state.containers[key], a.story.world().body);
  assert.equal(a.flag('maud_trust'), 5);
  assert.equal(a.flag('inn_cellar_cleared'), true);
  return { killed: 5, outcome: 'done', trust: 5, original_key: true };
}
