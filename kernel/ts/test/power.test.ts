// Balance tool 6 (cartridge.md Content reports; kernel/ts/play/power.ts): the power curve by level
// and the item sheet on a hand-written cartridge literal holding only the fields the tool reads.
// Expected values are hand-derived from the literal with the mechanics.md derived-stat formula.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { itemSheet, powerCurve } from '../play/power.ts';

const R = (kind: string, key: string) => ({ cartridge_id: 'p', cartridge_version: '1', kind, key });
const STR = R('attribute', 'str');
const CON = R('attribute', 'con');
const term = (attribute: object, per_point: number, pivot: number) => ({
  attribute,
  per_point,
  pivot,
});
const base = { manifest: { id: 'p', version: '1' } };

// STR and CON start 10; levels 1-3 grant 0, 2, 4 points; base chance 70, damage 2-4, hp 0..10.
const fixture = (hpTerms = [term(CON, 3, 10), term(STR, 1, 10)]) => ({
  ...base,
  attributes: { 'p@1:attribute/str': { start: 10 }, 'p@1:attribute/con': { start: 10 } },
  resources: { 'p@1:resource/hp': { minimum: 0, maximum: 10 } },
  world: {
    levelling: { thresholds: [30, 100], points_per_level: 2 },
    combat: { player_attack: { chance: 70, damage_min: 2, damage_max: 4 } },
    derived: {
      hit_chance: { terms: [term(STR, 1, 13)], divisor: 2 },
      damage: { terms: [term(STR, 1, 10)], divisor: 2 },
      hp_max: { terms: hpTerms },
    },
  },
  // belt listed first: the sheet orders by slot (finger < waist), not by ref or insertion
  items: {
    'p@1:item/belt': {
      slot: 'waist',
      affects: [
        { attribute: CON, modifier: 1 },
        { attribute: STR, modifier: -1 },
      ],
      mass_grams: 300,
    },
    'p@1:item/ring': { slot: 'finger', affects: [{ attribute: STR, modifier: 2 }] },
    'p@1:item/lamp': {},
  },
});

// Breaks: points x L instead of x (L - 1) (L1 damage [3, 5]); levels 1..thresholds count (two
// levels); the hp minimum or authored maximum dropped (L1 hp_max 0); truncating instead of the
// engine's floored division (L1 hit 69, since -3 / 2 floors to -2).
test('powerCurve: none and focused final stats for each level 1..thresholds + 1', () => {
  const none = { hit_chance: 68, damage: [2, 4], hp_max: 10 };
  assert.deepEqual(
    powerCurve(fixture()).map(({ level, hit_chance, damage, hp_max }) => ({
      level,
      focused: { hit_chance: hit_chance.focused, damage: damage.focused, hp_max: hp_max.focused },
      none: { hit_chance: hit_chance.none, damage: damage.none, hp_max: hp_max.none },
    })),
    [
      { level: 1, focused: none, none },
      { level: 2, focused: { hit_chance: 69, damage: [3, 5], hp_max: 16 }, none },
      { level: 3, focused: { hit_chance: 70, damage: [4, 6], hp_max: 22 }, none },
    ],
  );
});

// Break: focused spends the points on the first term, not the best one (L2 hp_max 12, not 16).
test('powerCurve: focused picks the best term wherever it is listed', () => {
  assert.equal(powerCurve(fixture([term(STR, 1, 10), term(CON, 3, 10)]))[1].hp_max.focused, 16);
});

// Break: delta measured from a zero bonus instead of the starts' bonus (ring hit -1, not +1);
// slotless items listed; sheet in ref order.
test('itemSheet: slotted items in slot order, each worn alone against the starts', () => {
  assert.deepEqual(itemSheet(fixture()), [
    {
      ref: 'p@1:item/ring',
      slot: 'finger',
      affects: [{ attribute: STR, modifier: 2 }],
      affect_total: 2,
      delta: { hit_chance: 1, damage: 1, hp_max: 2 },
    },
    {
      ref: 'p@1:item/belt',
      slot: 'waist',
      affects: [
        { attribute: CON, modifier: 1 },
        { attribute: STR, modifier: -1 },
      ],
      affect_total: 0,
      delta: { hit_chance: 0, damage: -1, hp_max: 2 },
      mass_grams: 300,
    },
  ]);
});

// Break: a level count or table invented without world.levelling and world.derived.
test('powerCurve: without levelling or derived tables, level 1 alone and no table', () => {
  assert.deepEqual(powerCurve(base), [{ level: 1 }]);
});
