import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load, prefix, ref } from './bell_fixture.ts';
import { validate } from '../src/foundation/validate.ts';

const reaction = `.cartridge.reactions["${prefix}:reaction/bell_suppress_goblins"]`;
const R = (c: any) => c.reactions[`${prefix}:reaction/bell_suppress_goblins`];

// Breaks: a declared audible room/fact/text or a suppression plan/trigger silently resolves to a
// missing or wrong definition.
test('D9 cue references and typed suppression declaration fail closed', () => {
  assert.equal(load().ok, true);
  for (const [change, code, path] of [
    [
      (c: any) => c.world.bell_cue.rooms.push(ref('room', 'absent')),
      'UNRESOLVED_REFERENCE',
      '.cartridge.world.bell_cue.rooms[2]',
    ],
    [
      (c: any) => (c.world.bell_cue.fact = ref('room', 'drill_yard')),
      'UNRESOLVED_REFERENCE',
      '.cartridge.world.bell_cue.fact',
    ],
    [
      (c: any) => (c.world.bell_cue.fact = ref('fact', 'lever_stage')),
      'FACT_TYPE_MISMATCH',
      '.cartridge.world.bell_cue.fact',
    ],
    [
      (c: any) => (c.world.bell_cue.text = 'absent'),
      'UNRESOLVED_REFERENCE',
      '.cartridge.world.bell_cue.text',
    ],
    [
      (c: any) => (R(c).apply[0].plan = ref('population', 'absent')),
      'SCHEMA_VIOLATION',
      `${reaction}.apply[0].plan`,
    ],
    [
      (c: any) => (R(c).apply[0].plan = ref('population', 'hens')),
      'SCHEMA_VIOLATION',
      `${reaction}.apply[0].plan`,
    ],
    [
      (c: any) => (R(c).on.fact = ref('fact', 'lever_stage')),
      'FACT_TYPE_MISMATCH',
      `${reaction}.on.fact`,
    ],
    [
      (c: any) => (R(c).on = { event: 'item_dropped', item: ref('item', 'ear') }),
      'OUTCOME_MISMATCH',
      `${reaction}.apply[0].op`,
    ],
  ] as const) {
    const loaded = load(change);
    assert.equal(loaded.ok, false, path);
    if (!loaded.ok)
      assert.deepEqual([loaded.diagnostic.code, loaded.diagnostic.path], [code, path]);
  }
});

// Breaks: a missing generation, deadline, or cause is accepted as resumable saved control.
test('D9 typed control and cue reject missing evidence and malformed deadlines', () => {
  const control = {
    job_id: 'aaaaaaaa-0000-4000-8000-000000000001',
    next_wander_due: 72000,
    suppression: {
      generation: 1,
      ends_at: 237600,
      job_id: 'aaaaaaaa-0000-4000-8000-000000000002',
      cause_event_id: 'aaaaaaaa-0000-4000-8000-000000000003',
    },
  };
  assert.deepEqual(validate('PopulationControl', control), []);
  for (const field of ['generation', 'ends_at', 'job_id', 'cause_event_id']) {
    const changed = structuredClone(control) as any;
    delete changed.suppression[field];
    assert.ok(validate('PopulationControl', changed).length, field);
  }
  const late = structuredClone(control);
  late.suppression.ends_at = -1;
  assert.ok(validate('PopulationControl', late).length);
  const record = {
    command_id: 'aaaaaaaa-0000-4000-8000-000000000001',
    lines: [{ key: 'narration.ring_bell' }],
    cue: {
      source_event_id: 'aaaaaaaa-0000-4000-8000-000000000003',
      command_id: 'aaaaaaaa-0000-4000-8000-000000000001',
      actor_id: 'aaaaaaaa-0000-4000-8000-000000000004',
      observer_id: 'aaaaaaaa-0000-4000-8000-000000000004',
      room_id: 'aaaaaaaa-0000-4000-8000-000000000005',
      logical_time: 64800,
      key: 'narration.bell_cue',
    },
  };
  assert.deepEqual(validate('NarrationRecord', record), []);
  for (const field of Object.keys(record.cue)) {
    const changed = structuredClone(record) as any;
    delete changed.cue[field];
    assert.ok(validate('NarrationRecord', changed).length, field);
  }
});
