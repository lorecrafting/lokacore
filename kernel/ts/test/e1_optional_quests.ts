// Controlled v042 routes; outcomes are literal authored answers, never generated oracles.
import assert from 'node:assert/strict';
import { level } from '../src/mechanics/resource.ts';
import type { DefinitionRef } from '../src/contracts.gen.ts';
import type { CaseHost } from './e1_case_host.ts';

const journal = (a: CaseHost, name: string) => a.view().journal.find((q) => q.quest.key === name)!;

const pennies = (a: CaseHost) =>
  level(a.story.world(), a.story.world().body, {
    cartridge_id: 'ashmere_missing_child',
    cartridge_version: '0.0.42',
    kind: 'resource',
    key: 'pennies',
  } as DefinitionRef);

export function chandlersDebt(a: CaseHost) {
  a.invoke('choose_ancestry', [], { ancestry: 'road_born' });
  a.move('north', 'west');
  a.invoke('a_peg_debt', [a.entity('npc', 'peg')]);
  a.choose('accept_on_time');
  a.reopen();
  assert.equal(a.flag('priory_tithe_delivered'), 'pending');
  a.move('east', 'north', 'north', 'north', 'north');
  a.invoke('a_aldric_debt', [a.entity('npc', 'aldric')]);
  a.reopen();
  a.choose('on_time');
  a.reopen();
  assert.equal(a.flag('priory_tithe_delivered'), 'on_time');
  assert.equal(a.flag('priory_fen_axis'), 2);
  assert.equal(journal(a, 'chandlers_debt').state, 'resolved');
  assert.equal(pennies(a), 30);
  a.invoke('a_aldric_debt', [a.entity('npc', 'aldric')], {}, 'invalid_state');
  a.reopen();
  assert.equal(a.flag('priory_fen_axis'), 2);
  assert.equal(pennies(a), 30);
}

export function lanternDream(a: CaseHost, branch: 'follow_fox' | 'wake') {
  a.invoke('choose_ancestry', [], { ancestry: 'road_born' });
  a.move('north', 'east');
  a.invoke('rent_lantern_room', [a.entity('npc', 'maud')], {
    quoted_price: 3,
    service: {
      cartridge_id: 'ashmere_missing_child',
      cartridge_version: '0.0.42',
      kind: 'service',
      key: 'lantern_room',
    },
  });
  a.move('up');
  a.invoke('rest');
  const dream = () => a.view().notices!.find((n) => n.bed)!.dream!;
  for (const line of [1, 2, 3]) {
    a.reopen();
    assert.equal(dream().index, line);
    assert.equal(a.flag('dream_seen'), false);
    a.invoke('dream_next', [], { scene: dream().scene, line });
  }
  a.reopen();
  const choice = dream().choice!,
    option = choice.choices.find((c) => c.choice_id === branch)!;
  assert.ok(option.action_key);
  a.invoke(option.action_key, [], {
    continuation_id: choice.continuation_id,
    choice_id: branch,
    dream: option.dream,
  });
  a.reopen();
  assert.equal(a.flag('dream_seen'), false);
  assert.equal(journal(a, 'a_room_at_the_lantern').state, 'active');
  const final = { scene: dream().scene, line: 5 };
  a.invoke('dream_next', [], final);
  a.reopen();
  assert.equal(a.flag('dream_seen'), true);
  assert.equal(journal(a, 'a_room_at_the_lantern').state, 'resolved');
  assert.equal(dream().branch, branch);
  a.invoke('dream_next', [], final, 'invalid_state');
  a.reopen();
  assert.equal(a.flag('dream_seen'), true);
}
