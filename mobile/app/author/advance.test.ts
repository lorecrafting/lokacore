// The browser's budget for one advance (loka-wfrgk.55): delivery is synchronous and its cost follows
// game time, so an advance far over it froze the tab, and the panel's restore replayed it on every boot.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advanced, replay, type Replayable, type Step } from './place.ts';

// Break: the budget is real ms, not game minutes (a rate-1 hour refused, a rate-2400 week accepted);
// an advance over it reaches the clock, on record or on restore; or the budget refuses its own last
// minute (3000 minutes at rate 7 is the panel's ceil of 25,714,285.7 ms).
test('an advance over 3000 game minutes is refused before the clock, recorded or replayed', () => {
  const moved: number[] = [];
  const steps: Step[] = [];
  const pulses: string[] = [];
  const game = { pulse: (mode: 'active' | 'drain') => (pulses.push(mode), { kind: 'ready' }) };
  const move = (ms: number) => moved.push(ms);
  const keep = (s: Step) => steps.push(s);
  assert.match(
    advanced(75_025, move, game, keep, 2400) ?? '',
    /3001 game minutes is over the 3000-minute budget/,
  );
  assert.deepEqual([moved, steps, pulses], [[], [], []]);
  assert.equal(advanced(75_000, move, game, keep, 2400), undefined);
  assert.equal(advanced(3_660_000, move, game, keep, 1), undefined);
  assert.equal(advanced(25_714_286, move, game, keep, 7), undefined);
  const restored = replay(
    [{ advance: 75_000 }, { advance: 75_025 }],
    game as unknown as Replayable,
    move,
    2400,
  );
  assert.deepEqual(restored, {
    done: 1,
    failed: 'step 2 (advance 75025): over the 3000-minute budget',
    refused: true,
  });
  assert.deepEqual(moved, [75_000, 3_660_000, 25_714_286, 75_000]);
});
