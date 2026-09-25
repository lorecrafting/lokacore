// Expected errors are hand-written in protocol/fixtures/invalid.json, parsed with JSON.parse
// so they never pass through the code under test.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decode, encode, hash } from '../src/canonical.ts';
import { DEFS } from '../src/contracts.gen.ts';
import { validate, type Defs } from '../src/validate.ts';
import { read } from './read.ts';
import { DEFS as PROBE } from './subset.gen.ts';

const defs = { ...DEFS, ...PROBE } as Defs;

test('every contract has examples and every example validates', () => {
  for (const [name, schema] of Object.entries(defs) as [string, { examples?: unknown[] }][]) {
    assert.ok(schema.examples?.length, `${name} has no examples`);
    for (const example of schema.examples)
      assert.deepEqual(validate(name, example, defs), [], name);
  }
});

test('invalid fixtures fail with exactly the listed errors', () => {
  for (const { contract, value, errors } of read('protocol/fixtures/invalid.json')) {
    assert.deepEqual(
      validate(contract, value, defs),
      errors,
      `${contract} ${JSON.stringify(value)}`,
    );
  }
});

test('the capability registry: valid entries, key@version unique, covers the chapter-one lock, all portable', () => {
  const pins = new Map<string, { portability: string }>();
  for (const entry of read('protocol/capability_registry.json')) {
    assert.deepEqual(validate('CapabilitySpec', entry), [], JSON.stringify(entry));
    const pin = `${entry.key}@${entry.version}`;
    assert.ok(!pins.has(pin), pin);
    pins.set(pin, entry);
  }
  // 00a §1: every chapter-one capability is portable (offline_private).
  const lock = read('protocol/fixtures/capability_lock_hash.json').value;
  for (const [key, version] of Object.entries(lock.capabilities))
    assert.equal(pins.get(`${key}@${version}`)?.portability, 'portable', key);
});

test('the capability lock encodes and hashes to the independent known answer', () => {
  const { value, canonical, sha256 } = read('protocol/fixtures/capability_lock_hash.json');
  assert.deepEqual(validate('CapabilityLock', value), []);
  assert.equal(encode(value), canonical);
  assert.equal(hash(value), sha256);
});

test('the hello cartridge encodes and hashes to the independent known answer', () => {
  const { value, canonical, sha256 } = read('protocol/fixtures/cartridge_hash.json');
  assert.deepEqual(validate('CompiledCartridge', value), []);
  assert.equal(encode(value), canonical);
  assert.equal(hash(value), sha256);
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

// 64 narration lines (an admission limit, decision.schema.json) is the maximum; 65 is not.
test('narration at 64 and 65 lines', () => {
  const lines = (n: number) => Array.from({ length: n }, () => ({ key: 'n' }));
  const accepted = (DEFS.DecisionResult as { examples: { kind: string }[] }).examples.find(
    (x) => x.kind === 'accepted',
  );
  const record = (n: number) => ({
    command_id: 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b',
    lines: lines(n),
  });
  assert.deepEqual(validate('DecisionResult', { ...accepted, narration: lines(64) }), []);
  assert.deepEqual(validate('NarrationRecord', record(64)), []);
  assert.deepEqual(validate('DecisionResult', { ...accepted, narration: lines(65) }), [
    { path: '/narration', code: 'too_many_items' },
  ]);
  assert.deepEqual(validate('NarrationRecord', record(65)), [
    { path: '/lines', code: 'too_many_items' },
  ]);
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
