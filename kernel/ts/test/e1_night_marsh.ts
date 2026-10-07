// Legal v042 S27 route; literal answers from mechanics.md C6 and cartridge.md S27.
import assert from 'node:assert/strict';
import type { CaseHost } from './e1_case_host.ts';

export function nightMarsh(a: CaseHost) {
  a.invoke('choose_ancestry', [], { ancestry: 'road_born' });
  a.move('south', 'south', 'east');
  const bones = a.detail('hound_run', 'gnawed_bones');
  const attempt = () => Object.values(a.story.world().state.expeditions ?? {})[0]!;
  a.invoke('begin_marsh_watch', [bones], { transition: 'start' });
  a.reopen();
  const occurrence = attempt().quest_instance_id,
    identity = attempt().attempt_id;
  assert.equal(attempt().status, 'active');
  assert.equal(attempt().cursor, 0);
  assert.equal(a.flag('fen_night_survived'), false);
  assert.equal(a.flag('priory_fen_axis'), 0);
  assert.ok(a.view().combat);
  a.invoke('flee');
  a.reopen();
  assert.equal(a.view().combat, undefined);
  // Adder Nest is a lawful Flee detour, but earns no ordered route entry.
  if (a.view().place.title.key === 'room.adder_nest.title') {
    assert.equal(attempt().cursor, 0);
    a.move('west');
    a.reopen();
    assert.equal(attempt().cursor, 0);
  }
  if (a.view().place.title.key === 'room.hound_run.title') a.move('west');
  a.reopen();
  assert.equal(a.view().place.title.key, 'room.reed_bank.title');
  assert.equal(attempt().cursor, 1);
  for (const [direction, destination, cursor] of [
    ['west', 'willow_shade', 2],
    ['south', 'drowned_oak', 3],
    ['north', 'willow_shade', 4],
    ['east', 'reed_bank', 5],
  ] as const) {
    assert.equal(a.flag('fen_night_survived'), false);
    a.move(direction);
    a.reopen();
    assert.equal(a.view().place.title.key, `room.${destination}.title`);
    assert.equal(attempt().cursor, cursor);
    assert.equal(attempt().quest_instance_id, occurrence);
    assert.equal(attempt().attempt_id, identity);
    if (cursor === 3) {
      const clock = a.story.world().state.clock;
      a.invoke('use_marsh_shelter', [a.detail('drowned_oak', 'marsh_shelter')], {
        transition: 'shelter',
        quest_instance_id: occurrence,
        attempt_id: identity,
        cursor: 3,
      });
      a.reopen();
      assert.equal(attempt().cursor, 3);
      assert.equal(attempt().sheltered, true);
      assert.equal(a.story.world().state.clock, clock);
    }
  }
  assert.equal(attempt().status, 'completed');
  assert.equal(a.flag('fen_night_survived'), true);
  assert.equal(a.flag('priory_fen_axis'), -1);
  assert.equal(a.story.world().state.quests![occurrence]!.state, 'resolved');
  assert.equal(a.story.world().state.quests![occurrence]!.outcome, 'completed');
  a.move('east');
  a.invoke('begin_marsh_watch', [bones], { transition: 'start' }, 'invalid_state');
  a.reopen();
  assert.equal(attempt().cursor, 5);
  assert.equal(a.flag('fen_night_survived'), true);
  assert.equal(a.flag('priory_fen_axis'), -1);
  return {
    outcome: 'completed',
    cursor: 5,
    sheltered: true,
    faction: -1,
    start_after_completion: 'refused',
  };
}
