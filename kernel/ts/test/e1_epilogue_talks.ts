// Selected v042 conversations after each committed chapter ending.
import assert from 'node:assert/strict';
import type { CaseHost } from './e1_case_host.ts';
import { ending } from './e1_paths.ts';

export function epilogueTalks(
  a: CaseHost,
  child: 'rescued' | 'stays' | 'lost',
  allegiance: 'prior' | 'fox',
  fox: 'stilled' | 'free',
) {
  ending(a, child, allegiance, fox);
  const prefix = 'a0_d9_';
  const talk = (dialogue: string, npc: string) => {
    a.invoke(dialogue, [a.entity('npc', npc)]);
    a.choose('leave');
    a.reopen();
    assert.equal(a.seen.dialogues.has(dialogue), true);
    assert.equal(a.seen.choices.has(`${dialogue}/leave`), true);
  };
  a.move('south', 'south');
  talk(`${prefix}elspeth_${child}_${allegiance}`, 'elspeth');
  a.move('north', 'north', 'south', 'east');
  talk(`${prefix}maud_${child}_${allegiance}`, 'maud');
  a.move('west', 'north', 'north', 'north', 'north');
  talk(`${prefix}aldric_${allegiance}`, 'aldric');
  a.move('south', 'south', 'south', 'south', 'south', 'south', 'south', 'south', 'south');
  talk(`${prefix}vesper_${allegiance}`, 'vesper');
  a.move('north', 'north', 'north', 'north', 'north', 'north', 'south', 'south', 'west');
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
  talk(`${prefix}sedge_${allegiance}`, 'sedge');
  return { child, allegiance, dialogues: 5, selected_choices: 5 };
}
