// The explainer's report as the author panel's sentences (docs/system/cartridge.md#author-preview).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sentences } from '../play/why_words.ts';

const fact = (key: string, equals: unknown, now: unknown, holds: boolean) => ({
  op: 'fact_compare',
  fact: { key },
  equals,
  now,
  holds,
});

// Break: the sentence loses what the fact is now, or what it needs (the owner's own example).
test('a fact says what it is and what it needs; never set reads unset', () => {
  assert.deepEqual(sentences({ policy: fact('met_thera', true, false, false) }), [
    { text: 'fact met_thera is false; needs true', ok: false, depth: 0 },
  ]);
  assert.equal(
    sentences({ policy: fact('met_thera', true, null, false) })[0]!.text,
    'fact met_thera is unset; needs true',
  );
});

// Breaks: a branch's verdict is not its operator's over its leaves; a nested row loses its depth.
test('all, any and not answer from their leaves, indented under them', () => {
  const yes = fact('a', 1, 1, true);
  const no = fact('b', 1, 2, false);
  assert.deepEqual(
    sentences({
      policy: {
        op: 'all',
        items: [
          { op: 'any', items: [no, yes] },
          { op: 'not', item: yes },
        ],
      },
    }).map((r) => [r.depth, r.ok, r.text]),
    [
      [0, false, 'all of these'],
      [1, true, 'any one of these'],
      [2, false, 'fact b is 2; needs 1'],
      [2, true, 'fact a is 1; needs 1'],
      [1, false, 'not this'],
      [2, true, 'fact a is 1; needs 1'],
    ],
  );
  assert.equal(sentences({ policy: { op: 'any', items: [no] } })[0]!.ok, false);
  assert.equal(sentences({ policy: { op: 'all', items: [yes] } })[0]!.ok, true);
  assert.equal(sentences({ policy: { op: 'not', item: no } })[0]!.ok, true);
});

// Break: a definition with no policy reads as refused, or throws.
test('no policy has no conditions', () => {
  assert.deepEqual(sentences({}), [{ text: 'It has no conditions.', ok: true, depth: 0 }]);
});
