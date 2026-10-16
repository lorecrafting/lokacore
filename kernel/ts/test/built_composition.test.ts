import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compose } from '../src/foundation/compose.ts';
import { read } from './read.ts';

// Breaks: a stale or absent expected tombstone composes, or a tombstone lands on an entity that
// is not a built room (Built rooms S5).
test('literal built composition cases', () => {
  for (const c of read('protocol/fixtures/built_composition.json').cases)
    assert.deepEqual(compose(c.state, { ops: c.ops }), c.expected, c.id);
});
