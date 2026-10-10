// Late and elapsed v042 debt routes; windows and values from cartridges/ashmere_missing_child/dialogues/a_{peg,aldric}_debt.json.
import assert from 'node:assert/strict';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import type { CaseHost } from './e1_case_host.ts';

// cartridge.json: calendar start 64800, real_elapsed rate 50 (1 host second = 50 logical units).
const clock = (a: CaseHost) => a.story.world().state.clock;
const refuse = (a: CaseHost, choice_id: string) =>
  a.invoke(
    'choose',
    [],
    { continuation_id: a.view().choice!.continuation_id, choice_id },
    'invalid_state',
  );
const pennies = (a: CaseHost) => {
  const w = a.story.world();
  return level(w, w.body, resourceRef(w, 'pennies'));
};
const debt = (a: CaseHost) =>
  Object.values(a.story.world().state.quests ?? {}).find((q) => q.quest.key === 'chandlers_debt');

export function debtLate(a: CaseHost) {
  a.invoke('choose_ancestry', [], { ancestry: 'road_born' });
  a.elapsed(1_729_000);
  assert.equal(clock(a), 151250); // inside late's 151201..237600, past on_time's 151200
  a.reopen();
  a.move('north', 'west');
  const peg = a.entity('npc', 'peg'),
    ledger = a.entity('item', 'tithe_ledger');
  assert.equal(a.story.world().state.containers[ledger], peg);
  a.invoke('a_peg_debt', [peg]);
  refuse(a, 'accept_on_time');
  a.choose('accept_late');
  a.invoke('close_choice'); // the hub stays open after an answer (loka-x6t.5): Leave the conversation
  a.reopen();
  assert.equal(debt(a)?.state, 'active');
  assert.equal(a.flag('priory_tithe_delivered'), 'pending');
  assert.equal(a.story.world().state.containers[ledger], a.story.world().body);
  a.move('east', 'north', 'north', 'north', 'north');
  const aldric = a.entity('npc', 'aldric');
  a.invoke('a_aldric_debt', [aldric]);
  refuse(a, 'on_time');
  a.choose('late');
  a.reopen();
  assert.equal(debt(a)?.state, 'resolved');
  assert.equal(debt(a)?.outcome, 'late');
  assert.equal(a.flag('priory_tithe_delivered'), 'late');
  assert.equal(a.flag('priory_fen_axis'), -1);
  assert.equal(a.story.world().state.containers[ledger], aldric);
  assert.equal(pennies(a), 20); // resources.json start; late has no payment, unlike on_time
  return { outcome: 'late', axis: -1 };
}

export function debtElapsed(a: CaseHost) {
  a.invoke('choose_ancestry', [], { ancestry: 'road_born' });
  a.elapsed(3_457_000);
  assert.equal(clock(a), 237650); // elapsed opens at 237601
  a.reopen();
  a.move('north', 'west');
  const peg = a.entity('npc', 'peg'),
    ledger = a.entity('item', 'tithe_ledger');
  a.invoke('a_peg_debt', [peg]);
  refuse(a, 'accept_on_time');
  refuse(a, 'accept_late');
  a.choose('elapsed');
  a.reopen();
  assert.equal(debt(a), undefined);
  assert.equal(a.flag('priory_tithe_delivered'), 'unoffered');
  assert.equal(a.story.world().state.containers[ledger], peg);
  assert.equal(a.view().choice, undefined);
  return { outcome: 'elapsed', quest: null };
}
