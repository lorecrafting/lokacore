// Expected errors are hand-written in protocol/fixtures/invalid.json, parsed with JSON.parse
// so they never pass through the code under test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decode } from '../src/canonical.ts';
import { DEFS } from '../src/contracts.gen.ts';
import { DEFS as PROBE } from './subset.gen.ts';
import { validate } from '../src/validate.ts';

const read = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../protocol/${name}`, import.meta.url), 'utf8'));
const defs = { ...DEFS, ...PROBE };

test('every contract has examples and every example validates', () => {
  for (const [name, schema] of Object.entries(defs) as [string, { examples?: unknown[] }][]) {
    assert.ok(schema.examples?.length, `${name} has no examples`);
    for (const example of schema.examples)
      assert.deepEqual(validate(name, example, defs), [], name);
  }
});

test('invalid fixtures fail with exactly the listed errors', () => {
  for (const { contract, value, errors } of read('fixtures/invalid.json')) {
    assert.deepEqual(
      validate(contract, value, defs),
      errors,
      `${contract} ${JSON.stringify(value)}`,
    );
  }
});

test('a declared __proto__ property survives generation', () => {
  assert.deepEqual(validate('SubsetProbe', JSON.parse('{"__proto__":"ok"}'), defs), []);
});

test('values outside the canonical profile are rejected at decode, before validation', () => {
  for (const text of ['{"n":1.0}', '{"n":1e0}', '{"n":1,"n":1}'])
    assert.throws(() => decode(text), { code: 'invalid_json' }, text);
});

// validate() takes decoded values, so recursion is bounded by the canonical depth cap: a
// Policy nested 128 deep decodes and validates; 129 is rejected by the decoder.
test('a recursive Policy at the depth cap', () => {
  const nots = (n: number) =>
    '{"op":"not","item":'.repeat(n) + '{"op":"target_present"}' + '}'.repeat(n);
  assert.deepEqual(validate('Policy', decode(nots(127))), []);
  assert.throws(() => decode(nots(128)), { code: 'invalid_json' });
});

// A 1025-id list is too large to keep as a fixture line; 1024 is the contract's maximum.
test('ambiguous candidates at 1024 and 1025', () => {
  const ids = (n: number) =>
    Array.from(
      { length: n },
      (_, i) => `${(i + 1).toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`,
    );
  assert.deepEqual(
    validate('TargetResolution', { kind: 'ambiguous', candidate_ids: ids(1024) }),
    [],
  );
  assert.deepEqual(validate('TargetResolution', { kind: 'ambiguous', candidate_ids: ids(1025) }), [
    { path: '/candidate_ids', code: 'too_many_items' },
  ]);
});
