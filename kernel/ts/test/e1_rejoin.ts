// Fixed v042 escort death/rejoin route and pre-bell Elspeth talks; journal keys and the
// hound pack from cartridges/ashmere_missing_child/{quests/missing_child,populations/fen_hounds}.json.
import assert from 'node:assert/strict';
import type { CaseHost } from './e1_case_host.ts';
import { childReturn, search } from './e1_paths.ts';

const journal = (a: CaseHost) =>
  a.view().journal.find((q) => q.quest.key === 'missing_child')!.journal;

function elspethTalks(a: CaseHost, child: 'rescued' | 'stays') {
  for (const choice of ['acknowledge', 'directions', 'inn']) {
    a.invoke(`b_elspeth_${child}`, [a.entity('npc', 'elspeth')]);
    a.choose(choice);
  }
}

export function rejoin(a: CaseHost) {
  search(a);
  a.move('south', 'south');
  a.invoke('a_vesper_meeting', [a.entity('npc', 'vesper')]);
  a.choose('meet_wren');
  a.invoke('b_vesper_riddle', [a.entity('npc', 'vesper')]);
  a.choose('answer', 'LANTERN');
  a.invoke('a_wren_escort', [a.entity('npc', 'wren')]);
  a.choose('rescue');
  assert.equal(journal(a), 'quest.missing_child.following');
  a.move('north', 'north', 'east');
  const w = a.story.world();
  const [hound] = Object.entries(w.state.created ?? {}).find(
    ([id, c]) =>
      c.definition.kind === 'npc' &&
      c.origin.kind === 'spawned' &&
      c.origin.by.key === 'fen_hounds' &&
      w.state.containers[id] === w.state.containers[w.body],
  )!;
  a.invoke('attack', [hound]);
  for (let round = 0; round < 40 && a.view().combat; round++) a.elapsed(3_000);
  assert.equal(a.view().place.title.key, 'room.chapel_nave.title', 'the pack must kill the player');
  assert.equal(journal(a), 'quest.missing_child.separated');
  a.reopen();
  a.move('south', 'south', 'south', 'south', 'south', 'south', 'south', 'east');
  a.invoke('b_wren_rejoin', [a.entity('npc', 'wren')]);
  a.choose('rejoin');
  assert.equal(journal(a), 'quest.missing_child.following');
  a.move('west', 'north', 'north');
  a.invoke('a_elspeth_rescue', [a.entity('npc', 'elspeth')]);
  a.choose('rescued');
  assert.equal(a.flag('village_child_status'), 'rescued');
  elspethTalks(a, 'rescued');
}

export function elspethStays(a: CaseHost) {
  search(a);
  childReturn(a, 'stays');
  elspethTalks(a, 'stays');
}
