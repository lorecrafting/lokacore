import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../src/foundation/validate.ts';
import { read } from './read.ts';

const id = '00000004-0000-4000-8000-000000000000';
const pack = read('protocol/fixtures/missing_child_v032_hash.json').value.populations[
  'ashmere_missing_child@0.0.32:population/fen_hounds'
];
const cases = read('protocol/fixtures/c4_pack_composition.json').cases;
const op = (name: string) => cases.flatMap((c: any) => c.ops).find((o: any) => o.op === name);

// Breaks: zero or over-100 flight thresholds, or an incomplete pack declaration, load as valid content.
test('C4 pack bounds and required fields reject invalid declarations', () => {
  const bad: [string, (v: any) => void][] = [
    ['flight minimum', (v) => (v.pack.flight_below_percent = 0)],
    ['flight maximum', (v) => (v.pack.flight_below_percent = 101)],
    ...['flight_below_percent', 'flight_fare', 'narration'].map(
      (key) =>
        [`pack requires ${key}`, (v: any) => delete v.pack[key]] as [string, (v: any) => void],
    ),
    ...['helper_joined', 'enemy_fled', 'primary_changed', 'pack_withdrew'].map(
      (key) =>
        [`narration requires ${key}`, (v: any) => delete v.pack.narration[key]] as [
          string,
          (v: any) => void,
        ],
    ),
  ];
  assert.deepEqual(validate('PopulationPlan', pack), []);
  for (const [name, change] of bad) {
    const value = structuredClone(pack);
    change(value);
    assert.notDeepEqual(validate('PopulationPlan', value), [], name);
  }
});

// Break: a 65-member saved or proposed roster passes the bounded encounter contract.
test('C4 encounter roster caps reject 65 members', () => {
  const open = op('encounter.open');
  const advance = op('encounter.advance');
  const row = advance.expected;
  for (const [name, contract, value] of [
    ['open roster cap', 'DeltaOp', open],
    ['advance roster cap', 'DeltaOp', advance],
    ['saved encounter roster cap', 'EncounterRow', row],
  ] as const) {
    assert.deepEqual(validate(contract, value), []);
    assert.notDeepEqual(validate(contract, { ...value, active_ids: Array(65).fill(id) }), [], name);
  }
});

// Breaks: Combat projects an empty or oversized pack, or an opponent without its exact ID/name.
test('C4 CombatView roster bounds and member identity reject malformed rows', () => {
  const view = {
    encounter_id: id,
    opponent_id: id,
    name: 'npc.hound',
    active_opponents: [{ id, name: 'npc.hound' }],
  };
  const bad = [
    ['view roster minimum', { ...view, active_opponents: [] }],
    [
      'view roster maximum',
      { ...view, active_opponents: Array(65).fill(view.active_opponents[0]) },
    ],
    ['view member requires ID', { ...view, active_opponents: [{ name: 'npc.hound' }] }],
    ['view member requires name', { ...view, active_opponents: [{ id }] }],
  ] as const;
  assert.deepEqual(validate('CombatView', view), []);
  for (const [name, value] of bad) assert.notDeepEqual(validate('CombatView', value), [], name);
});

// Break: a negative last-flight clock is accepted into a persisted population slot.
test('C4 population flight clock rejects negative time', () => {
  const slot = { generation: 1, member_id: id, replacement_due: null, last_flight_at: 5 };
  assert.deepEqual(validate('PopulationSlot', slot), []);
  assert.notDeepEqual(
    validate('PopulationSlot', { ...slot, last_flight_at: -1 }),
    [],
    'flight clock minimum',
  );
});
