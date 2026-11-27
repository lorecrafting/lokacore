// The generic sheet's pure logic (play/generic.ts, builder slice 2.3) on hand-built schemas: what a
// node draws as, a new field's least value, a picked branch's value, a moved list.
// Breaks: a recursive definition drawn past DEPTH, a claimed field or a map drawn as nothing,
// an allOf or an if/then's addable field dropped (also in a union's branches), a branch's required field left unset.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { branchOf } from '../play/card.ts';
import { least, moved, picked, shapeOf } from '../play/generic.ts';

const ref = (name: string) => ({ $ref: `#/$defs/${name}` });
const str = { type: 'string' };
const defs = {
  N: { type: 'object', properties: { next: ref('N') } },
  A: { type: 'object', properties: { a: str }, required: ['a'] },
};

test('a recursive definition draws DEPTH (3) levels deep, then nothing', () => {
  assert.equal(shapeOf(ref('N'), undefined, defs, ['N', 'N'])[0].as, 'object');
  assert.deepEqual(shapeOf(ref('N'), undefined, defs, ['N', 'N', 'N']), [
    { as: 'none' },
    ['N', 'N', 'N'],
  ]);
});

test('a text or a definition key is claimed; a missing definition draws nothing', () => {
  assert.deepEqual(shapeOf(ref('TextKey'), undefined, defs)[0], {
    as: 'claimed',
    claim: 'TextKey',
  });
  assert.deepEqual(shapeOf(ref('partial.DefinitionRef'), undefined, defs)[0], {
    as: 'claimed',
    claim: 'DefinitionRef',
  });
  assert.deepEqual(shapeOf(ref('Gone'), undefined, defs)[0], { as: 'none' });
});

test('a constant, an enum and a union each draw as such', () => {
  assert.deepEqual(shapeOf({ const: 'x', type: 'string' }, undefined, defs)[0], {
    as: 'const',
    value: 'x',
  });
  assert.deepEqual(shapeOf({ enum: ['a', 'b'], type: 'string' }, undefined, defs)[0], {
    as: 'enum',
    options: ['a', 'b'],
  });
  assert.deepEqual(shapeOf({ anyOf: [str] }, undefined, defs)[0], { as: 'union', branches: [str] });
});

test('properties alone, or a map alone, is an object; allOf folds its parts in', () => {
  assert.deepEqual(shapeOf({ properties: { s: str } }, undefined, defs)[0], {
    as: 'object',
    props: { s: str },
    each: undefined,
    required: [],
  });
  assert.deepEqual(shapeOf({ additionalProperties: str }, undefined, defs)[0], {
    as: 'object',
    props: {},
    each: str,
    required: [],
  });
  const all = { allOf: [ref('A'), { properties: { b: str }, required: ['b'] }] };
  assert.deepEqual(shapeOf(all, undefined, defs)[0], {
    as: 'object',
    props: { a: str, b: str },
    each: undefined,
    required: ['a', 'b'],
  });
});

test("an if/then/else draws the branch the value takes, the if's field addable as then declares it", () => {
  const flag = { const: true };
  const def = {
    if: { required: ['abstract'] },
    then: { type: 'object', properties: { abstract: flag } },
    else: { type: 'object', properties: { s: str } },
  };
  assert.deepEqual(shapeOf(def, {}, defs)[0], {
    as: 'object',
    props: { s: str, abstract: flag },
    each: undefined,
    required: [],
  });
  const scalar = { if: { required: ['k'] }, then: str, else: { type: 'integer' } };
  assert.deepEqual(shapeOf(scalar, {}, defs)[0], { as: 'scalar', type: 'integer' });
  const thenScalar = { if: { required: ['k'] }, then: str, else: { type: 'object' } };
  assert.deepEqual(shapeOf(thenScalar, {}, defs)[0], {
    as: 'object',
    props: {},
    each: undefined,
    required: [],
  });
  // a union of shapes (a scene's modal or dream): each inline branch offers the if's field
  const modal = { type: 'object', properties: { control: { const: 'modal' } } };
  const shapes = { ...def, else: { anyOf: [modal, ref('A')] } };
  assert.deepEqual(shapeOf(shapes, {}, defs)[0], {
    as: 'union',
    branches: [{ ...modal, properties: { control: { const: 'modal' }, abstract: flag } }, ref('A')],
  });
});

test('a new field starts at its least value: an open object {}, a list [], a string the author types', () => {
  assert.deepEqual(least({ type: 'object', allOf: [{}] }, defs), {});
  assert.deepEqual(least({ type: 'array', minItems: 1, items: str }, defs), []);
  assert.equal(least(str, defs), undefined);
});

test("a picked branch's required fields start at their least; present ones are kept", () => {
  const o = { type: 'object', allOf: [{}] };
  const branches = [
    {
      type: 'object',
      properties: { kind: { const: 'a' }, n: { type: 'integer', minimum: 2 }, o },
      required: ['kind', 'n', 'o'],
    },
    { type: 'object', properties: { kind: { const: 'b' }, o }, required: ['kind'] },
  ];
  assert.deepEqual(picked(branches, 0, undefined, defs), { kind: 'a', n: 2, o: {} });
  assert.deepEqual(picked(branches, 0, { kind: 'b', o: { z: 1 } }, defs), {
    kind: 'a',
    o: { z: 1 },
    n: 2,
  });
  assert.equal(picked([{ type: 'boolean' }, { type: 'integer', minimum: 3 }], 1, true, defs), 3);
  const untyped = { properties: { o }, required: ['o'] }; // an object by its properties alone
  assert.deepEqual(picked([str, untyped], 1, undefined, defs), { o: {} });
});

test('a list element moves up, or is copied after itself', () => {
  assert.deepEqual(moved([1, 2, 3], 2, 1), [1, 3, 2]);
  assert.deepEqual(moved([1, 2, 3], 0), [1, 1, 2, 3]);
});

// Break: a fact condition's `equals: true` drawn as a Key (FactValue's untyped `$ref` branch taken first).
test('a scalar takes the branch of its own type before an untyped one', () => {
  const factValue = [ref('Key'), { type: 'integer' }, { type: 'boolean' }];
  assert.deepEqual(
    [true, 3, 'k'].map((v) => branchOf(factValue, v)),
    [2, 1, 0],
  );
});
