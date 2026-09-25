// Expected errors are hand-written in protocol/fixtures/invalid.json, parsed with JSON.parse
// so they never pass through the code under test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decode, encode, hash } from '../src/canonical.ts';
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

test('the capability registry: valid entries, key@version unique, covers the chapter-one lock, all portable', () => {
  const pins = new Map<string, { portability: string }>();
  for (const entry of read('capability_registry.json')) {
    assert.deepEqual(validate('CapabilitySpec', entry), [], JSON.stringify(entry));
    const pin = `${entry.key}@${entry.version}`;
    assert.ok(!pins.has(pin), pin);
    pins.set(pin, entry);
  }
  // 00a §1: every chapter-one capability is portable (offline_private).
  const lock = read('fixtures/capability_lock_hash.json').value;
  for (const [key, version] of Object.entries(lock.capabilities))
    assert.equal(pins.get(`${key}@${version}`)?.portability, 'portable', key);
});

test('the capability lock encodes and hashes to the independent known answer', () => {
  const { value, canonical, sha256 } = read('fixtures/capability_lock_hash.json');
  assert.deepEqual(validate('CapabilityLock', value), []);
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
