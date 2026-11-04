// The spirit state's clock (book-ui.md, Spirit state), on controlled times.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { due, left, next, type Spirit } from './spirit.ts';

// Breaks: a lone revival line waits, the countdown rounds down, or the redraw timer sleeps past
// the next line (or the next second), or keeps ticking at zero.
test('the spirit clock wakes for each line and each second, and stops at zero', () => {
  assert.equal(due(1, 10, 0), 1);
  assert.equal(left(10, 4001), 6);
  const sp = (shown: number): Spirit => ({
    lines: ['a', 'b', 'c'],
    seconds: 1,
    at: 0,
    shown,
    held: [],
  });
  assert.equal(next(sp(1), 200), 300); // line b at 500
  assert.equal(next(sp(3), 200), 800); // all shown: the next second
  assert.equal(next(sp(3), 1000), undefined);
});
