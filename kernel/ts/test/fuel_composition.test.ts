import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compose } from '../src/foundation/compose.ts';
import { check } from '../src/runtime/invariants.ts';
import { read } from './read.ts';
const fixture = read('protocol/fixtures/fuel_composition.json');
// Break: fuel writes accept stale/malformed rows, undeclared items, out-of-bounds fuel or two writers.
test('portable fuel replacement matches independent literal valid and invalid answers', () => {
  for (const c of fixture.cases) {
    const delta = { ops: c.ops };
    assert.deepEqual(compose(c.state, delta), c.expected, c.id);
    assert.equal(
      check('delta_preconditions_hold', { state: c.state, delta, result: c.expected }),
      true,
      c.id,
    );
    const counterfeit = {
      changes: c.ops.map((o: any) => ({
        target: { kind: 'fuel', item_id: o.item_id },
        value: o.to,
      })),
    };
    if (c.expected.fault?.code === 'precondition_failed')
      assert.equal(
        check('delta_preconditions_hold', { state: c.state, delta, result: counterfeit }),
        false,
        c.id,
      );
  }
});
