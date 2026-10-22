// Pass-1 check 4's ratchet (sim_batch.ts unnarrated): the showcase sim's silent action keys against
// the pinned baseline, on controlled sets.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Command, DecisionResult } from '../src/contracts.gen.ts';
import { changeKey, SILENT, unnarrated } from './sim_batch.ts';

// Breaks: a new silent key that passes, an allowlisted one that fails, a pin kept after its key is narrated, or an unreached pin
// that fails (fixed seeds may stop reaching a key; that is not a fix).
test('unnarrated reports new silent keys and pins now narrated, never unreached pins', () => {
  const s = { changed: new Set(['take', 'sit', 'eat']), silent: new Set(['take', 'sit']) };
  assert.deepEqual(unnarrated(s, ['sit', 'eat', 'talk']), [
    'eat: narrated now; remove it from the baseline',
    'take: commits a change with no narration line',
  ]);
  SILENT.take = 'a reason';
  try {
    assert.deepEqual(unnarrated(s, ['sit']), []);
  } finally {
    delete SILENT.take;
  }
});

// Breaks: a key taken from a rejected step or an empty delta, or a recipe filed under its command type or
// under a verb's key (a recipe named take would hide behind the take pin).
test('changeKey names an accepted change by its command type, and a recipe by type and key', () => {
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
