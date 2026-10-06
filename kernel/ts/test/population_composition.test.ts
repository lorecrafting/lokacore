import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compose } from '../src/foundation/compose.ts';
import { check } from '../src/runtime/invariants.ts';
import { validate } from '../src/foundation/validate.ts';
import type { StateDelta } from '../src/contracts.gen.ts';

const cases = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/population_composition.json', import.meta.url),
    'utf8',
  ),
).cases;

// Breaks: a slot is rewritten without its full prior row, or combat and population share one slot.
test('population control and slot composition match independent literal rows', () => {
  for (const c of cases) {
    const delta = { ops: c.ops } as StateDelta;
    assert.deepEqual(validate('StateDelta', delta), [], c.id);
    const result = compose(c.state, delta);
    assert.deepEqual(result, c.expected, c.id);
    assert.equal(check('delta_preconditions_hold', { state: c.state, delta, result }), true, c.id);
  }
});

// Breaks: independent precondition replay accepts a forged successful row.
test('population invariant rejects counterfeit success', () => {
  const c = cases.find((x: { id: string }) => x.id === 'fatal-slot-and-independent-control');
  assert.equal(
    check('delta_preconditions_hold', {
      state: c.state,
      delta: { ops: c.ops },
      result: { changes: [] },
    }),
    false,
  );
});
