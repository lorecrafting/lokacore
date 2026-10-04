import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from '../src/commands/invocation.ts';
import { gameView } from '../src/runtime/world.ts';
import { CID, F, stepped, world } from './ferry_probe.ts';

// Breaks: an open exit still advertises Move after the room subtracts it from the ActionSet,
// although both invocation resolution and direct command admission refuse it.
test('exit availability follows the room-composed movement action', () => {
  const baseline = world();
  assert.equal(gameView(baseline).exits.find((e) => e.direction === 'north')!.available, true);
  assert.equal(stepped(baseline, { type: 'move', direction: 'north' }), 'accepted');

  const w = world((c) => {
    c.rooms[`${F}:room/ferry_landing`].actions = [{ op: 'subtract', actions: ['move'] }];
  });
  const view = gameView(w);
  const exit = view.exits.find((e) => e.direction === 'north')!;
  assert.deepEqual(
    { available: exit.available, reason: 'reason' in exit ? exit.reason : undefined },
    { available: false, reason: { code: 'unsupported_capability' } },
  );
  assert.equal(
    view.actions.some((a) => a.action_key === 'move'),
    false,
  );
  const invocation = {
    action_key: 'move',
    actor_id: w.character,
    target_ids: [],
    input: { direction: 'north' },
  };
  assert.deepEqual(resolve(w, { invocation, command_id: CID } as never), {
    kind: 'rejected',
    error: { code: 'unsupported_capability' },
  });
  assert.equal(stepped(w, { type: 'move', direction: 'north' }), 'unsupported_capability');
});
