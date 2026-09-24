// Expected errors are hand-written in protocol/fixtures/invalid.json, parsed with JSON.parse
// so they never pass through the code under test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DEFS } from '../src/contracts.gen.ts';
import { validate } from '../src/validate.ts';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../../../protocol/${name}`, import.meta.url), 'utf8'));
// The probe has no $ref, so its $defs need no flattening.
const defs = { ...DEFS, ...read('fixtures/subset.schema.json').$defs };

test('every contract has examples and every example validates', () => {
  for (const [name, schema] of Object.entries(defs) as [string, { examples?: unknown[] }][]) {
    assert.ok(schema.examples?.length, `${name} has no examples`);
    for (const example of schema.examples) assert.deepEqual(validate(name, example, defs), [], name);
  }
});

test('invalid fixtures fail with exactly the listed errors', () => {
  for (const { contract, value, errors } of read('fixtures/invalid.json')) {
    assert.deepEqual(validate(contract, value, defs), errors, `${contract} ${JSON.stringify(value)}`);
  }
});
