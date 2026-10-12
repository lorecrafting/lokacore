// Balance tool 6 (cartridge.md Content reports; kernel/ts/play/power.ts): the power curve by level
// and the item sheet on a hand-written cartridge literal holding only the fields the tool reads.
// Expected values are hand-derived from the literal with the mechanics.md derived-stat formula.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { itemSheet, powerCurve, report } from '../play/power.ts';

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

// STR at the ResourceInt maximum, DEX and CON 0; chance 90, damage 1-3, hp 2..10, carry 1000 g.
// hit +2147483647 -> 100; damage -2 -> [0, 1]; hp -10 -> 2 (the minimum); carry +1000 -> 2000.
const extremes = (carry?: object) => ({
  ...base,
  attributes: {
    'p@1:attribute/str': { start: 2147483647 },
    'p@1:attribute/dex': { start: 0 },
    'p@1:attribute/con': { start: 0 },
  },
  resources: { 'p@1:resource/hp': { minimum: 2, maximum: 10 } },
  world: {
    combat: { player_attack: { chance: 90, damage_min: 1, damage_max: 3 } },
    carry,
    derived: {
      hit_chance: { terms: [term(STR, 1, 0)] },
      damage: { terms: [term(R('attribute', 'dex'), 1, 2)] },
      carry_grams: { terms: [term(STR, 1, 2147482647)] },
      hp_max: { terms: [term(CON, 1, 10)] },
    },
  },
  items: {
    'p@1:item/charm': {
      slot: 'neck',
      affects: [
        { attribute: STR, modifier: 1 },
        { attribute: STR, modifier: -1 },
      ],
    },
  },
});

// Breaks: hit not capped at 100 (2147483647), damage not floored at 0 ([-1, 1]), hp
// not clamped at its minimum (0), the carry bonus subtracted (0), a table kept without its
// authored base (carry_grams NaN), and affects saturated one by one instead of summed first as
// attributes@1 does (STR max + 1 - 1 reads max - 1: carry delta -1, not 0).
test('powerCurve and itemSheet: clamps, carry, a baseless table and summed affects', () => {
  const at = <T>(v: T) => ({ none: v, focused: v }); // level 1 has no point to spend
  assert.deepEqual(powerCurve(extremes({ max_grams: 1000 })), [
    { level: 1, hit_chance: at(100), damage: at([0, 1]), carry_grams: at(2000), hp_max: at(2) },
  ]);
  assert.equal('carry_grams' in powerCurve(extremes())[0], false);
  assert.deepEqual(itemSheet(extremes({ max_grams: 1000 }))[0].delta, {
    hit_chance: 0,
    damage: 0,
    carry_grams: 0,
    hp_max: 0,
  });
});

// Break: a level count or table invented without world.levelling and world.derived.
test('powerCurve: without levelling or derived tables, level 1 alone and no table', () => {
  assert.deepEqual(powerCurve(base), [{ level: 1 }]);
});

// fixture() with a gear budget (balance 6b): finger 1, head 3, waist 0, +1 per level above 1.
const budgeted = () => {
  const c = fixture();
  const worn = (slot: string, intended_level: number | undefined, ...mods: [object, number][]) => ({
    slot,
    affects: mods.map(([attribute, modifier]) => ({ attribute, modifier })),
    ...(intended_level && { intended_level }),
  });
  return {
    ...c,
    world: {
      ...c.world,
      gear_budget: { per_slot: { finger: 1, head: 3, waist: 0 }, per_level: 1 },
    },
    items: {
      'p@1:item/ring': worn('finger', 1, [STR, 2]),
      'p@1:item/ring2': worn('finger', 2, [STR, 2]),
      'p@1:item/belt': worn('waist', 1, [CON, 1], [STR, -1]),
      'p@1:item/helm': worn('head', 3, [CON, 6]),
      'p@1:item/boots': worn('feet', 1, [STR, 1]),
      'p@1:item/cap': worn('head', undefined, [STR, 1]),
      'p@1:item/gloves': worn('hands', undefined, [STR, 1]),
      'p@1:item/amulet': { slot: 'neck' },
      'p@1:item/lamp': {},
    },
  };
};

// Breaks: an absolute instead of signed sum (belt over, 2 > 0); >= instead of > (ring2 over at
// 2 = 2); per_level x L instead of x (L - 1) (helm allowed 6, ring allowed 2: neither over); a slot
// missing from per_slot read as 0 (boots over, not unbudgeted); the slot tested before the level
// (gloves, in neither, reported missing slot); items without affects listed.
test('report: budget lists over-budget and unbudgeted items in sheet order', () => {
  assert.deepEqual(report(budgeted()).budget, {
    over: [
      { ref: 'p@1:item/ring', slot: 'finger', intended_level: 1, affect_total: 2, allowed: 1 },
      { ref: 'p@1:item/helm', slot: 'head', intended_level: 3, affect_total: 6, allowed: 5 },
    ],
    unbudgeted: [
      { ref: 'p@1:item/boots', missing: 'slot' },
      { ref: 'p@1:item/gloves', missing: 'intended_level' },
      { ref: 'p@1:item/cap', missing: 'intended_level' },
    ],
  });
});

// Break: a budget key (even an empty one) printed without world.gear_budget.
test('report: without world.gear_budget the document is levels and items alone', () => {
  assert.deepEqual(Object.keys(report(fixture())), ['levels', 'items']);
});
