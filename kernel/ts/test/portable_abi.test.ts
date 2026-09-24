// Frozen fixtures from docs/spec/IMPORT.md, read in place and parsed with JSON.parse so
// expected values never pass through the code under test.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decode, encode, hash } from '../src/canonical.ts';
import { add, divide, mul, sub } from '../src/int.ts';
import { id } from '../src/id_source.ts';
import { next, uniform } from '../src/rng.ts';

function fixture(name: string, sha: string) {
  const bytes = readFileSync(new URL(`../../../docs/spec/conformance/${name}`, import.meta.url));
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== sha) throw new Error(`${name} hash ${actual}, expected ${sha} (docs/spec/IMPORT.md)`);
  return JSON.parse(bytes.toString('utf8'));
}

const vectors = fixture('numeric-vectors.json', '85472ae4e7626ca7326b881766e21ae23dd253c82b5c9d4c8d0c86f89ee168c9');
const adverse = fixture('adverse-cases.json', '1b699cf2ce71181a2b09a596ed2253c06caa435aad4b5eb8a8ea9601fbadf5b1');

const code = (c: string) => ({ code: c });

test('numeric-vectors: rng_steps from initial_rng', () => {
  let state = vectors.initial_rng;
  for (const step of vectors.rng_steps) {
    assert.deepEqual(next(state), [step.raw, step.state]);
    state = step.state;
  }
});

test('numeric-vectors: division', () => {
  for (const { a, b, q, r } of vectors.division) assert.deepEqual(divide(a, b), [q, r], `${a} / ${b}`);
});

test('numeric-vectors: invalid_json', () => {
  for (const text of vectors.invalid_json) assert.throws(() => decode(text), code('invalid_json'), text);
});

test('numeric-vectors: canonical', () => {
  for (const { input, expected } of vectors.canonical) assert.equal(encode(decode(input)), expected);
});

test('adverse-cases: uniform', () => {
  for (const row of adverse.uniform) {
    const run = () => uniform(row.state, row.bound, row.max_draws);
    if (row.error) assert.throws(run, code(row.error), JSON.stringify(row));
    else assert.deepEqual(run(), [row.value, row.next_state], JSON.stringify(row));
  }
});

// Catches an off-by-one that rejects the top bound 2^32, where every draw is accepted:
// the answer is the first raw draw and state of numeric-vectors rng_steps.
test('uniform accepts bound 2^32', () => {
  assert.deepEqual(uniform([1, 2, 3, 4], 4294967296, 1), [11520, [7, 0, 1026, 12288]]);
});

// Catches missing strictness the fixtures do not reach: lowercase surrogate-pair escapes,
// lone surrogates (escaped or raw UTF-16), raw control characters, negative range edge,
// leading zeros, non-ASCII keys, trailing data, duplicates spelled with escapes, and
// "__proto__" becoming a prototype; missing colon; a dropped short escape on input.
test('decode edge cases', () => {
  assert.deepEqual(decode('["\\ud83d\\ude00",-9007199254740991]'), ['😀', -9007199254740991]);
  assert.equal(encode(decode('{"__proto__":1}')), '{"__proto__":1}');
  for (const text of ['["\\udc00"]', '["\ud800a"]', '["\x01"]', '-9007199254740992', '01', '{"é":1}', '[1]x', '{"a":1,"\\u0061":2}', '', '{"a",1}']) {
    assert.throws(() => decode(text), code('invalid_json'), text);
  }
  assert.throws(() => decode(null as never), code('invalid_json'));
  assert.equal(decode('"\\b\\f\\n\\r\\t\\"\\\\\\/"'), '\b\f\n\r\t"\\/');
});

// Catches wrong escapes (uppercase hex, \u0008 for \b, escaping / or non-ASCII) and key
// order that is not ordinal (JS enumerates integer-like keys first, numerically).
test('encode escapes and key order', () => {
  const value = { b: 1, B: 2, a: 3, 9: 4, 10: 5, s: '\x01\x1f\b\t\n\f\r"\\/\x7f幻' };
  assert.equal(encode(value), '{"10":5,"9":4,"B":2,"a":3,"b":1,"s":"\\u0001\\u001f\\b\\t\\n\\f\\r\\"\\\\/\x7f幻"}');
});

// Catches an encoder that silently emits floats, unsafe integers, lone surrogates or bad keys.
test('encode rejects values outside the profile', () => {
  for (const v of [1.5, NaN, 9007199254740992, '\ud800', { é: 1 }, undefined]) {
    assert.throws(() => encode(v as never), code('invalid_canonical'), String(v));
  }
});

// Catches a missing or off-by-one depth limit: without one, how deep a value may nest
// depends on the host's stack (smaller on Hermes), and the two kernels disagree.
test('nesting is limited to 128 containers', () => {
  const nest = (n: number) => '['.repeat(n) + ']'.repeat(n);
  const deepest = decode(nest(128));
  assert.equal(encode(deepest), nest(128));
  assert.throws(() => decode(nest(129)), code('invalid_json'));
  assert.throws(() => encode([deepest]), code('invalid_canonical'));
  assert.throws(() => encode({ a: deepest }), code('invalid_canonical'));
});

// Expected: printf '%s' '<canonical>' | shasum -a 256
test('hash is lowercase SHA-256 of the canonical bytes', () => {
  // '{"a":"x","b":1}'
  assert.equal(hash({ b: 1, a: 'x' }), 'cdab067e9f3beb32d1252cfd63e492592fecbf591b0d08cadb24bb17f3864246');
  // '["é幻😀𠀋",-7]': 2-, 3- and 4-byte UTF-8, above U+1FFFF too
  assert.equal(hash(['é幻😀𠀋', -7]), '6770c1e57b41f706835d6999cca3df572ac681152db03d185adf8916be83fed6');
  // 55 bytes: the largest message whose padding fits one block
  assert.equal(hash('a'.repeat(53)), '2ae89a8121a3f9d2709899b414da4c60234316951093ce35f41ce954a09533f4');
  // a 56-byte message: padding spills into a second block
  assert.equal(hash('a'.repeat(54)), '9b68496ab8c784a9ed22d25a7e3aada1736d7097061bb3149f3d66f1e22ceeef');
  // 120 bytes: one whole block read in place, then a padded tail
  assert.equal(hash('a'.repeat(118)), 'decf5e51fc0969aa2a06512dde0d3521a7ecd297ea81212ca626a65d2d4a1716');
});

// mul(94906266, 94906266) is 9007199326062756 exactly: a check that lost precision, or
// Math.imul, would miss it.
test('checked integers overflow as a typed error', () => {
  const max = 9007199254740991;
  assert.equal(add(max, 0), max);
  assert.throws(() => add(max, 1), code('integer_overflow'));
  assert.throws(() => sub(-max, 1), code('integer_overflow'));
  assert.equal(mul(-max, -1), max);
  assert.throws(() => mul(94906266, 94906266), code('integer_overflow'));
  assert.throws(() => divide(1, 0), code('division_by_zero'));
  assert.deepEqual(divide(0, -3), [0, 0]); // not -0: the profile has no negative zero
});

// Catches the kernels diverging at the contract edge: a bad budget must be the typed error
// Elixir returns, not a silent 'rng_budget_exhausted' (NaN or negative skips the loop).
test('uniform rejects a bad draw budget', () => {
  for (const budget of [-1, 1.5, NaN, true]) {
    assert.throws(() => uniform([1, 2, 3, 4], 10, budget as never), code('invalid_rng_budget'), String(budget));
  }
});

// Catches a non-string id being hashed into an id Elixir can never produce.
test('IdSource rejects non-string ids', () => {
  assert.throws(() => id(1 as never, 'c-1', 0), code('invalid_id'));
  assert.throws(() => id('w-1', null as never, 0), code('invalid_id'));
});

// Catches operands that are not safe integers slipping through, or the zero-divisor check
// running first (Elixir checks operands first, so both kernels must).
test('unsafe operands are integer_overflow', () => {
  for (const [a, b] of [[9007199254740992, 1], [1, 1.5], [true, 1]]) {
    for (const op of [add, sub, mul, divide]) {
      assert.throws(() => op(a as never, b as never), code('integer_overflow'), `${op.name}(${a}, ${b})`);
    }
  }
  assert.throws(() => divide(1.5, 0), code('integer_overflow'));
});

// Catches an unsafe ordinal being hashed instead of the typed error Elixir returns.
test('IdSource rejects a bad ordinal', () => {
  for (const ordinal of [-1, 9007199254740992, 1.5, NaN]) {
    assert.throws(() => id('w-1', 'c-1', ordinal), code('invalid_ordinal'), String(ordinal));
  }
});

// Expected values, computed independently with Python:
//   python3 -c 'import hashlib,json,sys; w,c,o=sys.argv[1],sys.argv[2],int(sys.argv[3]); h=bytearray(hashlib.sha256(json.dumps(["loka-id-v1",w,c,o],separators=(",",":"),ensure_ascii=False).encode()).digest()[:16]); h[6]=h[6]&15|128; h[8]=h[8]&63|128; x=h.hex(); print("-".join([x[:8],x[8:12],x[12:16],x[16:20],x[20:]]))' w-1 c-1 0
test('IdSource ids', () => {
  assert.equal(id('w-1', 'c-1', 0), 'eab7cf24-f843-8907-ab7a-610cf750dbe5');
  assert.equal(id('w-1', 'c-1', 1), 'c47e5589-bb15-82c7-8492-7c392ee99f8d');
  assert.equal(id('世界', 'c"1', 9007199254740991), '1711b795-4ff1-81d8-a547-80b2011ee4d1');
});
