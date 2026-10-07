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

// Break: an independent guard accepts forged success over a present-null row as first insertion.
test('knowledge invariant refuses forged success over null visit and observation rows', () => {
  const cases = read('protocol/fixtures/knowledge_composition.json').cases;
  for (const [bad, success] of [
    ['null-visit-is-not-absence', 'entry-records-distinct-actor-room'],
    ['null-observation-is-not-absence', 'observation-retains-exact-npc-room-time'],
  ]) {
    const c = cases.find((c: any) => c.id === bad);
    const result = cases.find((c: any) => c.id === success).expected;
    assert.equal(
      check('delta_preconditions_hold', { state: c.state, delta: { ops: c.ops }, result }),
      false,
      bad,
    );
  }
});
