import assert from 'node:assert/strict';
import { test } from 'node:test';
import { refString } from '../src/runtime/decision.ts';
import { command, elapsed, fixture, hp } from './c5_bleed_fixture.ts';

// Breaks: a round-first refresh makes a due expiry handoff fault because its future cadence stays fixed.
test('same-time round revives an early expiry without advancing its future cadence', () => {
  const { world, target, room } = fixture();
  const first = elapsed(
    command(world, 1, { type: 'attack', target_id: target }, 1).world,
    64950,
    2,
  );
  assert.equal(first.decision.kind, 'accepted');
  const fled = command(first.world, 2, { type: 'flee' }, 3);
  assert.equal(fled.decision.kind, 'accepted');
  const waited = elapsed(fled.world, 64975, 4);
  assert.equal(waited.decision.kind, 'accepted');
  const from = waited.world.state.containers[world.body];
  const direction = Object.entries(waited.world.rooms[from].exits).find(
    ([, edge]) => waited.world.roomIds[refString(edge.to)] === room,
  )?.[0];
  assert.ok(direction);
  const returned = command(waited.world, 3, { type: 'move', direction }, 5);
  assert.equal(returned.decision.kind, 'accepted');
  const engaged = command(returned.world, 4, { type: 'attack', target_id: target }, 6);
  assert.equal(engaged.decision.kind, 'accepted');
  const tick = elapsed(engaged.world, 65050, 7);
  assert.equal(tick.decision.kind, 'accepted');
  const refresh = elapsed(tick.world, 65125, 8);
  assert.equal(refresh.decision.kind, 'accepted');
  const escaped = command(refresh.world, 5, { type: 'flee' }, 9);
  assert.equal(escaped.decision.kind, 'accepted');
  const tick1 = elapsed(escaped.world, 65150, 10);
  const tick2 = elapsed(tick1.world, 65250, 11);
  const away = elapsed(tick2.world, 65275, 12);
  for (const result of [tick1, tick2, away]) assert.equal(result.decision.kind, 'accepted');
  const back = command(away.world, 6, { type: 'move', direction }, 13);
  assert.equal(back.decision.kind, 'accepted');

  // Fixed command 27 makes the round JobId sort before the already pending bleed JobId.
  const reengaged = command(back.world, 27, { type: 'attack', target_id: target }, 14);
  assert.equal(reengaged.decision.kind, 'accepted');
  const before = elapsed(reengaged.world, 65350, 15);
  assert.equal(before.decision.kind, 'accepted', JSON.stringify(before.decision));
  const bleed = before.world.state.bleeds![world.body]!;
  const round = Object.values(before.world.state.encounters ?? {}).find(
    (row) => row.status === 'open',
  )!;
  assert.ok(bleed.active);
  assert.equal(bleed.next_tick_at, 65450);
  assert.equal(bleed.ends_at, 65425);
  assert.equal(before.world.state.jobs![bleed.job_id!].due_time, 65425);
  assert.equal(before.world.state.jobs![round.job_id].due_time, 65425);
  assert.ok(round.job_id < bleed.job_id!);
  const paired = elapsed(before.world, 65425, 16);
  assert.equal(paired.decision.kind, 'accepted', JSON.stringify(paired.decision));
  assert.equal(hp(paired.world), 3);
  const after = paired.world.state.bleeds![world.body]!;
  assert.ok(after.active);
  assert.equal(after.ends_at, 65725);
  assert.equal(after.next_tick_at, 65450);
  assert.equal(paired.world.state.jobs![after.job_id!].due_time, 65450);
});
