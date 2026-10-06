import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compose } from '../src/foundation/compose.ts';
import { check } from '../src/runtime/invariants.ts';
import { validate } from '../src/foundation/validate.ts';
import type { StateDelta } from '../src/contracts.gen.ts';

const cases = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/water_composition.json', import.meta.url),
    'utf8',
  ),
).cases;

// Breaks: water occupancy is rewritten with stale prior generation/body/custody or a different writer.
test('water occupancy and deadline job composition match independent literal rows', () => {
  for (const c of cases) {
    const delta = { ops: c.ops } as StateDelta;
    assert.deepEqual(validate('StateDelta', delta), [], c.id);
    const result = compose(c.state, delta);
    assert.deepEqual(result, c.expected, c.id);
    if (c.prefix_expected)
      assert.deepEqual(compose(c.state, delta, false), c.prefix_expected, c.id);
    assert.equal(check('delta_preconditions_hold', { state: c.state, delta, result }), true, c.id);
  }
});

// Breaks: an independent precondition checker accepts a counterfeit success with incomplete job binding.
test('independent job invariant rejects partial actor/body/generation success', () => {
  const good = cases.find((c: any) => c.id === 'bound-expiry-occurrence');
  for (const c of cases.filter((c: any) => c.id.startsWith('missing-job-binding-'))) {
    const fake = structuredClone(good.expected);
    delete fake.changes[0].value[c.id.replace('missing-job-binding-', '')];
    assert.equal(
      check('delta_preconditions_hold', { state: c.state, delta: { ops: c.ops }, result: fake }),
      false,
      c.id,
    );
  }
});
