import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compose } from '../src/foundation/compose.ts';
import { check } from '../src/runtime/invariants.ts';
import { read } from './read.ts';

// Breaks: portable knowledge writes lose target identity, overwrite a visit or accept stale/future observations.
test('knowledge composition matches independent row and refusal fixtures', () => {
  for (const c of read('protocol/fixtures/knowledge_composition.json').cases) {
    const delta = { ops: c.ops };
    const result = compose(c.state, delta);
    assert.deepEqual(result, c.expected, c.id);
    assert.equal(check('delta_preconditions_hold', { state: c.state, delta, result }), true, c.id);
  }
});
