// Fixed v042 legal routes; literal terminal answers come from cartridge.md A3's table.
import assert from 'node:assert/strict';
import type { CaseHost } from './e1_case_host.ts';

export const ENDINGS = [
  ['rescued', 'prior', 'stilled'],
  ['rescued', 'fox', 'free'],
  ['stays', 'prior', 'stilled'],
  ['stays', 'fox', 'free'],
  ['lost', 'prior', 'stilled'],
] as const;

export function search(a: CaseHost) {
  a.invoke('choose_ancestry', [], { ancestry: 'fen_born' });
  a.invoke('elspeth', [a.entity('npc', 'elspeth')]);
  a.choose('accept');
  a.move('north', 'north');
  a.invoke('take', [a.entity('item', 'fox_drawing')]);
  a.move('south', 'south');
  a.invoke('a_elspeth_report', [a.entity('npc', 'elspeth')]);
  a.choose('report');
  a.move('south', 'south');
  a.invoke('study_tracks', [a.detail('reed_bank', 'tracks')]);
  assert.equal(a.flag('fen_tracks_found'), true);
}

export function childReturn(a: CaseHost, child: 'rescued' | 'stays') {
  a.move('south', 'south');
  a.invoke('a_vesper_meeting', [a.entity('npc', 'vesper')]);
  a.choose('meet_wren');
  a.invoke('b_vesper_riddle', [a.entity('npc', 'vesper')]);
  a.choose('answer', 'LANTERN');
  if (child === 'stays') {
    a.invoke('c_vesper_answered', [a.entity('npc', 'vesper')]);
    a.choose('carry_message');
  } else {
    a.invoke('a_wren_escort', [a.entity('npc', 'wren')]);
    a.choose('rescue');
  }
  a.move('north', 'north', 'north', 'north');
  a.invoke(child === 'stays' ? 'a_elspeth_return' : 'a_elspeth_rescue', [
    a.entity('npc', 'elspeth'),
  ]);
  a.choose(child);
  assert.equal(a.flag('village_child_status'), child);
}

export function bell(a: CaseHost, allegiance: 'prior' | 'fox', lost: boolean) {
  a.move(...Array(lost ? 7 : 5).fill('north'));
  a.invoke('a_aldric_offer', [a.entity('npc', 'aldric')]);
  a.choose('accept');
  a.move('up', 'up');
  a.invoke(allegiance === 'prior' ? 'ring_bell' : 'silence_bell', [a.detail('belfry', 'bell')]);
  while (a.view().scene) {
    a.reopen();
    a.next();
  }
  a.move('down', 'down', 'south', 'south', 'south');
  assert.equal(a.view().place.title.key, 'room.village_green.title');
}

export function ending(
  a: CaseHost,
  child: 'rescued' | 'stays' | 'lost',
  allegiance: 'prior' | 'fox',
  fox: 'stilled' | 'free',
) {
  search(a);
  if (child !== 'lost') childReturn(a, child);
  bell(a, allegiance, child === 'lost');
  assert.equal(a.view().scene, undefined, 'arrival must not begin an epilogue');
  assert.deepEqual(
    [
      a.flag('memory_village_ending'),
      a.flag('memory_fox_fate'),
      a.flag('memory_chapter_1_guild_tilt'),
      a.flag('story_point_prologue_completed'),
    ],
    ['unreached', 'unreached', 'unreached', 'unreached'],
  );
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM report').get()!.n, 0);
  a.invoke(`begin_epilogue_${child}_${allegiance}`, [a.detail('village_green', 'market_cross')]);
  for (const index of [1, 2, 3]) {
    a.reopen();
    assert.equal(a.view().scene!.index, index);
    assert.equal(
      a.sql.prepare('SELECT count(*) AS n FROM report').get()!.n,
      0,
      'report precedes final acknowledgement',
    );
    a.next();
  }
  a.reopen();
  assert.equal(a.view().scene, undefined);
  assert.deepEqual(
    [
      a.flag('memory_village_ending'),
      a.flag('memory_fox_fate'),
      a.flag('memory_chapter_1_guild_tilt'),
      a.flag('story_point_prologue_completed'),
    ],
    [child, fox, allegiance, `${child}_${allegiance}`],
  );
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM report').get()!.n, 1);
  assert.ok(a.invocations.length < 400, `fresh main path used ${a.invocations.length} invocations`);
  return {
    child,
    allegiance,
    fox,
    player_invocations: a.invocations.length,
    elapsed_commands: a.commands.filter((c) => c.payload.type === 'elapsed').length,
  };
}

// Literal selected row and faction answer from the v042 fey ancestry declaration.
export function feyAncestry(a: CaseHost) {
  assert.equal(a.story.world().state.characters?.[a.initial.character], undefined);
  a.invoke('choose_ancestry', [], { ancestry: 'fey_touched' });
  a.reopen();
  const selected = a.story.world().state.characters![a.initial.character]!;
  assert.equal(selected.ancestry, 'fey_touched');
  assert.equal(selected.attributes['ashmere_missing_child@0.0.42:attribute/spi'], 11);
  assert.equal(a.flag('priory_fen_axis'), -2);
  return { ancestry: 'fey_touched', spi: 11, faction: -2 };
}
