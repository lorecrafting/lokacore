// Legal v042 watch route; literal answers from mechanics.md S3 and cartridge.md C2.
import assert from 'node:assert/strict';
import type { CaseHost } from './e1_case_host.ts';
import { ferry } from './e1_paths.ts';

export function watchRounds(a: CaseHost) {
  a.invoke('choose_ancestry', [], { ancestry: 'road_born' });
  // Swim admits the well dive whose drowning is the death that fails the patrol (mechanics.md S3).
  a.move('west');
  ferry(a, 'boathouse', 'board_ferry', 'fen_outbound', 2);
  a.move('east');
  a.invoke('sedge_swim', [a.entity('npc', 'sedge')]);
  a.choose('learn');
  a.move('west');
  ferry(a, 'fen_isle_landing', 'return_ferry', 'fen_return', 0);
  a.move('east', 'north', 'north', 'north', 'east');
  const leader = a.entity('npc', 'tobin');
  const patrol = () => Object.values(a.story.world().state.patrols ?? {})[0]!;
  const choose = (choice_id: string) => {
    a.invoke('tobin_watch', [leader]);
    a.reopen();
    const choice = a.view().choice!,
      option = choice.choices.find((c) => c.choice_id === choice_id)!;
    assert.equal(option.available, true, `watch must offer ${choice_id}`);
    a.invoke('choose', [], {
      continuation_id: choice.continuation_id,
      choice_id,
      ...(option.patrol && { patrol: option.patrol }),
    });
    a.reopen();
  };
  choose('start');
  const failed = patrol().attempt_id;
  a.move('west', 'south', 'south', 'down', 'down');
  a.elapsed(120_000); // water duration 6000 at rate 50; death.shrine is chapel_nave
  a.reopen();
  assert.equal(a.view().place.title.key, 'room.chapel_nave.title');
  assert.equal(patrol().status, 'failed');
  a.move('south', 'south', 'east');
  choose('restart');
  const attempt = patrol().attempt_id;
  assert.notEqual(attempt, failed);
  assert.equal(patrol().status, 'together');
  assert.equal(patrol().credit.length, 0);
  assert.equal(a.flag('watch_gate_trusts_player'), false);
  choose('continue');
  assert.equal(patrol().status, 'awaiting');
  assert.equal(patrol().credit.length, 0);
  a.move('east'); // Detour to Watch Cell pauses; returning beside Tobin earns no credit.
  a.reopen();
  assert.equal(patrol().status, 'paused');
  a.move('west', 'west');
  a.reopen();
  assert.equal(a.view().place.title.key, 'room.north_gate.title');
  assert.equal(patrol().status, 'paused');
  assert.equal(patrol().credit.length, 0);
  choose('rejoin');
  assert.equal(patrol().attempt_id, attempt);
  assert.equal(patrol().status, 'together');
  assert.equal(patrol().credit.length, 0);
  for (const [direction, destination, credit] of [
    ['south', 'village_green', 1],
    ['east', 'east_gate', 2],
    ['west', 'village_green', 2],
    ['north', 'north_gate', 3],
    ['east', 'watch_post', 4],
  ] as const) {
    choose('continue');
    assert.equal(patrol().status, 'awaiting');
    assert.equal(a.flag('watch_gate_trusts_player'), false);
    a.move(direction);
    a.reopen();
    assert.equal(a.view().place.title.key, `room.${destination}.title`);
    assert.equal(patrol().credit.length, credit);
    assert.equal(patrol().attempt_id, attempt);
  }
  assert.equal(patrol().status, 'completed');
  assert.deepEqual(
    patrol()
      .credit.map((room) => a.story.world().rooms[room]!.key)
      .sort(),
    ['east_gate', 'north_gate', 'village_green', 'watch_post'],
  );
  assert.equal(a.flag('watch_gate_trusts_player'), true);
  const quest = Object.values(a.story.world().state.quests ?? {}).find(
    (q) => q.quest.key === 'watch_rounds',
  )!;
  assert.equal(quest.state, 'resolved');
  assert.equal(quest.outcome, 'completed');
  a.invoke('tobin_watch', [leader]);
  const final = a.view().choice!,
    denied = final.choices.find((c) => c.choice_id === 'continue')!;
  assert.equal(denied.available, false);
  a.invoke(
    'choose',
    [],
    { continuation_id: final.continuation_id, choice_id: 'continue', patrol: denied.patrol },
    'invalid_state',
  );
  a.reopen();
  assert.equal(patrol().credit.length, 4);
  assert.equal(a.flag('watch_gate_trusts_player'), true);
  return {
    outcome: 'completed',
    checkpoints: 4,
    rejoined: true,
    restarted: true,
    terminal_room: 'watch_post',
  };
}
