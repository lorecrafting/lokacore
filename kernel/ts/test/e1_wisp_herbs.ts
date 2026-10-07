// Literal v042 route answers from mechanics.md S4/S9 and cartridge.md B6/B5.
import assert from 'node:assert/strict';
import type { CaseHost } from './e1_case_host.ts';

export function wispWard(a: CaseHost) {
  a.invoke('choose_ancestry', [], { ancestry: 'road_born' });
  a.move('south', 'south', 'south', 'east');
  const wisp = a.entity('npc', 'wisp');
  const quest = () =>
    Object.entries(a.story.world().state.quests ?? {}).find(
      ([, q]) => q.quest.key === 'wisp_ward',
    )!;
  a.invoke('seek_wisp', [a.detail('marsh_light', 'glow')]);
  a.reopen();
  assert.equal(a.flag('fen_wisp_discovered'), true);
  assert.equal(a.flag('fen_wisp_answered'), false);
  assert.equal(a.flag('topic_ward_known'), false);
  a.invoke('a_wisp_offer', [wisp]);
  a.reopen();
  a.choose('accept');
  a.reopen();
  const occurrence = quest()[0];
  a.invoke('b_wisp_riddle', [wisp]);
  a.reopen();
  const first = a.view().choice!.continuation_id;
  for (const [answer, count] of [
    ['EDIT', 1],
    ['DIET', 2],
    ['TIED', 3],
  ] as const) {
    a.choose('answer', answer);
    a.reopen();
    assert.equal(quest()[0], occurrence);
    assert.equal(quest()[1].state, 'active');
    assert.equal(a.flag('fen_wisp_answered'), false);
    assert.equal(a.flag('topic_ward_known'), false);
    if (count < 3) {
      assert.equal(a.view().choice!.continuation_id, first);
      assert.deepEqual(a.view().choice!.riddle!.attempts, { count, limit: 3 });
    } else assert.equal(a.view().choice, undefined);
  }
  a.invoke('b_wisp_riddle', [wisp]);
  a.reopen();
  assert.notEqual(a.view().choice!.continuation_id, first);
  assert.deepEqual(a.view().choice!.riddle!.attempts, { count: 0, limit: 3 });
  a.choose('answer', 'TIDE');
  a.reopen();
  assert.equal(quest()[0], occurrence);
  assert.equal(quest()[1].state, 'resolved');
  assert.equal(quest()[1].outcome, 'answer');
  assert.equal(a.flag('fen_wisp_answered'), true);
  assert.equal(a.flag('topic_ward_known'), true);
  assert.deepEqual(a.story.world().state.rng, [1, 2, 3, 4]);
  a.move('west', 'north', 'north', 'north', 'north', 'north', 'north', 'north', 'north');
  a.invoke('c_aldric_ward', [a.entity('npc', 'aldric')]);
  a.reopen();
  const choice = a.view().choice!.continuation_id;
  assert.equal(a.story.world().state.choices![choice]!.source.key, 'c_aldric_ward');
  a.choose('ward');
  a.reopen();
  assert.equal(a.flag('topic_ward_known'), true);
  return {
    outcome: 'answer',
    ward: true,
    wrong_sitting_closed: true,
    terminal_room: 'chapel_nave',
  };
}

export function infirmaryHerbs(a: CaseHost) {
  a.invoke('choose_ancestry', [], { ancestry: 'road_born' });
  a.move('south', 'south', 'west');
  const patch = a.detail('willow_shade', 'fenwort_patch');
  for (let n = 0; n < 12; n++) a.invoke('harvest', [patch]);
  a.reopen();
  a.invoke('harvest', [patch], {}, 'not_found');
  const wick = a.entity('npc', 'wick');
  const held = (family: string, owner: string) =>
    Array.from({ length: 12 }, (_, n) => `${family}_${String(n + 1).padStart(2, '0')}`).filter(
      (key) => a.story.world().state.containers[a.entity('item', key)] === owner,
    ).length;
  assert.equal(held('fenwort', a.story.world().body), 12);
  assert.equal(held('bandage', wick), 12);
  a.move('east', 'north', 'north', 'north', 'north', 'north', 'north', 'north', 'north', 'east');
  assert.equal(a.view().place.title.key, 'room.infirmary.title');
  const occurrences = new Set<string>();
  for (const [contribution, bandages, herbs] of [
    [1, 3, 9],
    [2, 6, 6],
    [3, 9, 3],
    [3, 12, 0],
  ] as const) {
    a.invoke('a_wick_offer', [wick]);
    a.reopen();
    a.choose('accept');
    a.reopen();
    const rows = Object.entries(a.story.world().state.quests ?? {}).filter(
      ([, q]) => q.quest.key === 'infirmary_herbs',
    );
    assert.equal(rows.length, 1);
    const [id] = rows[0]!;
    assert.equal(occurrences.has(id), false);
    occurrences.add(id);
    a.invoke('b_wick_turn_in', [wick]);
    a.reopen();
    a.choose('exchange');
    a.reopen();
    assert.equal(a.story.world().state.quests![id]!.state, 'resolved');
    assert.equal(a.flag('infirmary_contribution'), contribution);
    assert.equal(a.flag('priory_fen_axis'), contribution);
    assert.equal(held('bandage', a.story.world().body), bandages);
    assert.equal(held('bandage', wick), herbs);
    assert.equal(held('fenwort', a.story.world().body), herbs);
    assert.equal(held('fenwort', wick), bandages);
  }
  assert.equal(occurrences.size, 4);
  return { exchanges: 4, contribution: 3, bandages: 12, terminal_room: 'infirmary' };
}
