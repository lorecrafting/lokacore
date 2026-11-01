import assert from 'node:assert/strict';
import { test } from 'node:test';
import { creditsOf } from './credits.ts';

// Break: a credit line lost, doubled, or an uncredited CC0 row drawing an empty line.
test('credits: one line per distinct credit, nothing for a row without one', () => {
  assert.deepEqual(
    creditsOf([
      { credit: 'A by B' },
      { credit: null },
      {},
      { credit: 'A by B' },
      { credit: 'C by D' },
    ]),
    ['A by B', 'C by D'],
  );
});
