import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compose } from '../src/foundation/compose.ts';
import { check } from '../src/runtime/invariants.ts';
import { read } from './read.ts';

// Breaks: spent custody can be reversed, or nonfood/nested/foreign food enters the terminal holder.
test('terminal custody composition and independent success observation use literal cases', () => {
  for (const c of read('protocol/fixtures/food_composition.json').cases) {
    const delta = { ops: c.ops };
    assert.deepEqual(compose(c.state, delta), c.expected, c.id);
    assert.equal(
      check('delta_preconditions_hold', { state: c.state, delta, result: c.observation }),
      c.holds,
      c.id,
    );
  }
});
