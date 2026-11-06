// The browser's budget for one advance (loka-wfrgk.55): delivery is synchronous, so an advance far
// over it froze the tab, and the panel's restore replayed it on every boot.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advanced, replay, type Replayable, type Step } from './place.ts';

// Break: an advance over the budget reaches the clock, on record or on restore; or the budget
// refuses the advance at it; or replay's default is not the budget (the panel's restore passes none).
// The check passes Infinity (kernel/ts/test/check.test.ts).
test('an advance over the budget is refused before the clock, recorded or replayed', () => {
  const moved: number[] = [];
  const steps: Step[] = [];
  const pulses: string[] = [];
  const game = { pulse: (mode: 'active' | 'drain') => (pulses.push(mode), { kind: 'ready' }) };
  const move = (ms: number) => moved.push(ms);
  const keep = (s: Step) => steps.push(s);
  assert.match(
    advanced(3_600_001, move, game, keep) ?? '',
    /3600001 ms is over the 3600000 ms budget/,
  );
  assert.deepEqual([moved, steps, pulses], [[], [], []]);
  assert.equal(advanced(3_600_000, move, game, keep), undefined);
  const restored = replay(
    [{ advance: 3_600_000 }, { advance: 3_600_001 }],
    game as unknown as Replayable,
    move,
  );
  assert.deepEqual(restored, {
    done: 1,
    failed: 'step 2 (advance 3600001): over the 3600000 ms budget',
    refused: true,
  });
  assert.deepEqual([moved, steps], [[3_600_000, 3_600_000], [{ advance: 3_600_000 }]]);
});
