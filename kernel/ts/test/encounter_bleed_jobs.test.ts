import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encountersHold } from '../src/runtime/invariants_encounter.ts';
import { read } from './read.ts';

const bound = read('protocol/fixtures/bleed_composition.json').cases.find(
  (c: any) => c.id === 'bound-bleed-job',
);
const schedule = bound.ops[0];
const pending = bound.expected.changes[0].value;
const result = (value: object) => ({
  changes: [{ target: { kind: 'job', job_id: schedule.job_id }, value }],
});

// Break: independent replay drops lawful body/generation provenance, accepting its omission instead.
test('independent job replay preserves the frozen bleed schedule binding', () => {
  assert.equal(encountersHold(bound.state, bound.ops, bound.expected), true);
  for (const field of ['bleed_body_id', 'bleed_generation']) {
    const omitted = { ...pending };
    delete omitted[field];
    assert.equal(encountersHold(bound.state, bound.ops, result(omitted)), false, field);
    assert.equal(
      encountersHold(
        bound.state,
        bound.ops,
        result({ ...pending, [field]: field === 'bleed_body_id' ? schedule.job_id : 2 }),
      ),
      false,
      field,
    );
  }
});

// Break: independent replay trusts counterfeit success for a partial, unbound or mixed bleed schedule.
test('independent job replay rejects invalid bleed schedules even with matching rows', () => {
  const mutations = [
    { bleed_body_id: undefined },
    { bleed_generation: undefined },
    { bleed_body_id: undefined, bleed_generation: undefined },
    { job: { ...schedule.job, kind: 'npc' } },
    { encounter_id: schedule.job_id },
    { quest_instance_id: schedule.job_id, actor_id: schedule.bleed_body_id },
    { actor_id: schedule.bleed_body_id },
    { water_body_id: schedule.bleed_body_id },
    { water_generation: 1, water_body_id: schedule.bleed_body_id },
    { sight: { member_id: schedule.bleed_body_id } },
    { crow_member_id: schedule.bleed_body_id, crow_generation: 1, crow_phase: 'leg' },
  ];
  for (const mutation of mutations) {
    const op = JSON.parse(JSON.stringify({ ...schedule, ...mutation }));
    assert.equal(
      encountersHold(
        bound.state,
        [op],
        result(JSON.parse(JSON.stringify({ ...pending, ...mutation }))),
      ),
      false,
      JSON.stringify(mutation),
    );
  }
});

// Break: lawful bleed cancellation is refused, or cancellation accepts a different body/generation.
test('independent job replay cancels only the exact pending bleed occurrence', () => {
  const state = { clock: 0, jobs: { [schedule.job_id]: pending } };
  const cancel = {
    op: 'job.cancel',
    writer_group: 0,
    job_id: schedule.job_id,
    bleed_body_id: schedule.bleed_body_id,
    bleed_generation: schedule.bleed_generation,
  };
  const cancelled = result({ ...pending, status: 'cancelled' });
  assert.equal(encountersHold(state, [cancel], cancelled), true);
  for (const mutation of [
    { bleed_body_id: schedule.job_id },
    { bleed_generation: 2 },
    { bleed_body_id: undefined },
    { bleed_generation: undefined },
    { encounter_id: schedule.job_id },
    { water_generation: 1 },
    { sight_member_id: schedule.bleed_body_id },
    { crow_member_id: schedule.bleed_body_id, crow_generation: 1 },
  ])
    assert.equal(encountersHold(state, [{ ...cancel, ...mutation }], cancelled), false);
});
