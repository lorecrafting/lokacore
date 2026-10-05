import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compose } from '../src/foundation/compose.ts';
import { check } from '../src/runtime/invariants.ts';

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/encounter_composition.json', import.meta.url),
    'utf8',
  ),
);

// Breaks: encounter identity/location guards, stale round/job acceptance, lost binding or future cancellation rejected.
test('encounter and bound job composition matches portable literal rows', () => {
  for (const c of fixture.cases) {
    const state = fixture.states[c.state];
    const delta = { ops: c.ops };
    assert.deepEqual(compose(state, delta), c.expected, c.id);
    assert.equal(
      check('delta_preconditions_hold', { state, delta, result: c.expected }),
      true,
      c.id,
    );
  }
});

// Breaks: success-only invariant trusts a counterfeit valid-looking row despite a failed guard.
test('independent encounter preconditions reject matching counterfeit success', () => {
  for (const c of fixture.cases.filter((c: any) => c.counterfeit))
    assert.equal(
      check('delta_preconditions_hold', {
        state: fixture.states[c.state],
        delta: { ops: c.ops },
        result: c.counterfeit,
      }),
      false,
      c.id,
    );
});

// Break: valid operation preconditions conceal an omitted/miswritten encounter or job row.
test('independent replay verifies every written lifecycle row', () => {
  for (const c of fixture.cases.filter((c: any) => c.expected.changes)) {
    const result = structuredClone(c.expected);
    for (const change of result.changes) {
      if (change.target.kind === 'encounter') change.value.round++;
      if (change.target.kind === 'job')
        change.value.encounter_id = 'ffffffff-0000-4000-8000-000000000000';
    }
    assert.equal(
      check('delta_preconditions_hold', {
        state: fixture.states[c.state],
        delta: { ops: c.ops },
        result,
      }),
      false,
      c.id,
    );
  }
});

// Break: cancellation fails to release its pending-job budget slot before a replacement is scheduled.
test('cancelling a future job frees one slot in a full queue', () => {
  const first = 'aaaaaaaa-0000-4000-8000-000000000001';
  const encounter = '00000006-0000-4000-8000-000000000000';
  const next = '00000008-0000-4000-8000-000000000000';
  const job = { cartridge_id: 'lantern', cartridge_version: '0.1.0', kind: 'npc', key: 'wolf' };
  const queued = { job, due_time: 20, status: 'pending', encounter_id: encounter };
  const jobs = Object.fromEntries(
    Array.from({ length: 1024 }, (_, i) => [
      `aaaaaaaa-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      queued,
    ]),
  );
  const ops = [
    { op: 'job.cancel', writer_group: 0, job_id: first, encounter_id: encounter },
    {
      op: 'job.schedule',
      writer_group: 0,
      job_id: next,
      job,
      due_time: 30,
      encounter_id: encounter,
    },
  ];
  assert.deepEqual(compose({ clock: 10, jobs }, { ops } as never), {
    changes: [
      {
        target: { kind: 'job', job_id: next },
        value: { job, due_time: 30, status: 'pending', encounter_id: encounter },
      },
      {
        target: { kind: 'job', job_id: first },
        value: { job, due_time: 20, status: 'cancelled', encounter_id: encounter },
      },
    ],
  });
});

// Breaks: explicit due-time settlement uses the base clock, escapes the advance or runs backwards in the overlay.
test('resource delivery times settle literal rows and reject counterfeit preconditions', () => {
  const times = JSON.parse(
    readFileSync(
      new URL('../../../protocol/fixtures/resource_delivery_time.json', import.meta.url),
      'utf8',
    ),
  );
  for (const c of times.cases) {
    const state = times.states[c.state],
      delta = { ops: c.ops };
    assert.deepEqual(compose(state, delta), c.expected, c.id);
    assert.equal(
      check('delta_preconditions_hold', { state, delta, result: c.expected }),
      true,
      c.id,
    );
    if (c.counterfeit)
      assert.equal(
        check('delta_preconditions_hold', { state, delta, result: c.counterfeit }),
        false,
        c.id,
      );
    else {
      const result = structuredClone(c.expected);
      result.changes[0].value.at++;
      assert.equal(check('delta_preconditions_hold', { state, delta, result }), false, c.id);
    }
  }
});
