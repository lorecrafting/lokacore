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
