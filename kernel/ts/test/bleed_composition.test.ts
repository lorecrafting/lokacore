import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compose } from '../src/foundation/compose.ts';
import { read } from './read.ts';

// Breaks: a foreign writer shares a body bleed target, or a spent bandage cannot enter the terminal holder.
test('literal bleed and terminal composition cases', () => {
  for (const c of read('protocol/fixtures/bleed_composition.json').cases)
    assert.deepEqual(compose(c.state, { ops: c.ops }), c.expected, c.id);
});
