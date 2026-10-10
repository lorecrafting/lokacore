import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compose } from '../src/foundation/compose.ts';
import { read } from './read.ts';

// Breaks: a stale or absent expected row composes, experience falls, a spent point is taken back,
// or two writes in one proposal do not chain (toolbox row 4).
test('literal levelling composition cases', () => {
  for (const c of read('protocol/fixtures/levelling_composition.json').cases)
    assert.deepEqual(compose(c.state, { ops: c.ops }), c.expected, c.id);
});
