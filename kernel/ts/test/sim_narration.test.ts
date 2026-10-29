// Pass-1 check 4 (sim_batch.ts changeKey): which action key a step's committed change files under.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Command, DecisionResult } from '../src/contracts.gen.ts';
import { changeKey } from './sim_batch.ts';

// Breaks: a key taken from a rejected step or an empty delta, or a scripted action filed under its command type or
// under a verb's key (a silent scripted action named take would be reported as the take verb).
test('changeKey names an accepted change by its command type, and a scripted action by type and key', () => {
  const cmd = (payload: object) => ({ payload }) as unknown as Command;
  const ok = (n: number) =>
    ({ kind: 'accepted', delta: { ops: Array(n).fill({}) } }) as unknown as DecisionResult;
  assert.equal(
    changeKey(cmd({ type: 'perform', action: 'oil_winch' }), ok(1)),
    'perform:oil_winch',
  );
  assert.equal(changeKey(cmd({ type: 'perform', action: 'take' }), ok(1)), 'perform:take');
  assert.equal(changeKey(cmd({ type: 'take' }), ok(1)), 'take');
  assert.equal(changeKey(cmd({ type: 'take' }), ok(0)), undefined);
  assert.equal(
    changeKey(cmd({ type: 'take' }), { kind: 'rejected' } as unknown as DecisionResult),
    undefined,
  );
});
