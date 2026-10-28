// Every case of every protocol/fixtures/*_composition.json fixture runs here: the literal
// composed answer, its in-progress prefix answer, the independent precondition replay on the
// result (or on a fixture observation), and a counterfeit success that replay must reject.
// Bespoke tests follow, one block per former file.
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';
import { compose } from '../src/foundation/compose.ts';
import { validate } from '../src/foundation/validate.ts';
import { check } from '../src/runtime/invariants.ts';
import { read } from './read.ts';

const DIR = 'protocol/fixtures';
// character_composition.json is one object, not a case table; compose.test.ts owns it.
const files = readdirSync(new URL(`../../../${DIR}`, import.meta.url))
  .filter((name) => name.endsWith('_composition.json') && name !== 'character_composition.json')
  .concat('population_suppression.json');

// A named state is a row of fixture.states; `extends` copies another row, then applies `edits`.
function stateOf(states: any, name: string): any {
  const row = states[name];
  if (!row.extends) return structuredClone(row);
  const state = stateOf(states, row.extends);
  for (const edit of row.edits) (state[edit.section] ??= {})[edit.key] = edit.value;
  return state;
}

function runCase(fx: any, c: any, msg: string) {
  const state = typeof c.state === 'string' ? stateOf(fx.states, c.state) : (c.state ?? fx.state);
  const delta = { ops: c.ops };
  const result = compose(state, delta);
  // Refusal cases may carry malformed ops on purpose; an accepted delta must be wire-valid.
  if (!c.expected.fault) assert.deepEqual(validate('StateDelta', delta), [], msg);
  assert.deepEqual(result, c.expected, msg);
  if (c.prefix_expected) assert.deepEqual(compose(state, delta, false), c.prefix_expected, msg);
  const observed = c.observation ?? result;
  assert.equal(
    check('delta_preconditions_hold', { state, delta, result: observed }),
    c.holds ?? true,
    msg,
  );
  for (const id of ['liquid_rows_valid', 'no_last_writer_wins'])
    assert.ok(check(id, { state, delta, result }), `${msg}: ${id}`);
  const fake = c.counterfeit ?? c.counterfeit_success;
  if (fake)
    assert.equal(check('delta_preconditions_hold', { state, delta, result: fake }), false, msg);
}

for (const file of files)
  test(`${file}: every case`, () => {
    const fx = read(`${DIR}/${file}`);
    assert.ok(fx.cases?.length, `${file} has no cases`);
    for (const c of fx.cases) runCase(fx, c, `${file} ${c.id}`);
  });

// From c4_pack_composition.
{
  const fixture = read('protocol/fixtures/c4_pack_composition.json');
  // Breaks: final flight proof is applied to the runtime's in-progress prefix before encounter closure.
  test('a legal transfer and stamp remain composable before their round exit is appended', () => {
    const c = fixture.cases.find(
      (row: { id: string }) => row.id === 'flight-stamp-requires-same-group-encounter-exit',
    );
    assert.deepEqual(
      compose(stateOf(fixture.states, c.state), { ops: c.ops }, false),
      c.counterfeit,
    );
  });
}

// From crow_composition.
{
  const cases = read('protocol/fixtures/crow_composition.json').cases.concat(
    read('protocol/fixtures/crow_review_composition.json').cases,
  );
  // Breaks: a claimed successful transition omits the persisted crow row.
  test('crow invariant rejects a counterfeit success', () => {
    const c = cases[0];
    assert.equal(
      check('delta_preconditions_hold', {
        state: c.state,
        delta: { ops: c.ops },
        result: { changes: [] },
      }),
      false,
    );
  });

  // Breaks: the job-cancel wire validator still assumes a single alternative to encounter_id.
  test('crow-only job cancellation is valid; missing every alternative is rejected', () => {
    const op = {
      op: 'job.cancel',
      writer_group: 0,
      job_id: '44444444-4444-4444-8444-444444444444',
      crow_member_id: '11111111-1111-4111-8111-111111111111',
      crow_generation: 1,
    };
    assert.deepEqual(validate('DeltaOp', op), []);
    assert.notDeepEqual(validate('DeltaOp', { op: op.op, writer_group: 0, job_id: op.job_id }), []);
  });

  // Breaks: an unphased crow job is persisted, losing the stale-acquire/return distinction.
  test('a crow-bound schedule requires its closed phase', () => {
    const c = cases.find((c: { id: string }) => c.id === 'schedule-phase-bound-crow-job');
    const op = c.ops[0];
    const { crow_phase: _phase, ...missing } = op;
    assert.deepEqual(compose(c.state, { ops: [missing] }), {
      fault: {
        kind: 'fault',
        code: 'precondition_failed',
        target: { kind: 'job', job_id: op.job_id },
      },
    });
    assert.notDeepEqual(validate('DeltaOp', { ...op, crow_phase: 'paused_return' }), []);
  });
}

// From bleed_composition.
{
  // Breaks: generic admission accepts an active wound missing any one owned occurrence field.
  test('active bleed rows and containing deltas require the complete occurrence', () => {
    const op = read('protocol/fixtures/bleed_composition.json').cases[0].ops[0];
    const fields = ['effect', 'source_id', 'ends_at', 'next_tick_at', 'job_id'];
    for (const field of fields) {
      const value = { ...op.value };
      delete value[field];
      assert.deepEqual(validate('BleedRow', value), [
        { path: '/' + field, code: 'missing_property' },
      ]);
      assert.deepEqual(validate('DeltaOp', { ...op, value }), [
        { path: '/value/' + field, code: 'missing_property' },
      ]);
    }
    assert.deepEqual(
      validate('BleedRow', { active: false, generation: 1, job_id: op.value.job_id }),
      [{ path: '/job_id', code: 'unknown_property' }],
    );
  });

  // Breaks: the fourth cancellation binding is omitted or can share a sight binding.
  test('bleed cancellation is the fourth exclusive job binding', () => {
    const op = {
      op: 'job.cancel',
      writer_group: 0,
      job_id: '11111111-2222-4333-8444-555555555555',
      bleed_body_id: '11111111-2222-4333-8444-555555555555',
      bleed_generation: 1,
    };
    assert.deepEqual(validate('DeltaOp', op), []);
    assert.deepEqual(validate('DeltaOp', { ...op, sight_member_id: op.bleed_body_id }), [
      { path: '', code: 'exclusive_properties' },
    ]);
    const { bleed_generation: _generation, ...partial } = op;
    assert.deepEqual(validate('DeltaOp', partial), [
      { path: '/bleed_generation', code: 'missing_property' },
    ]);
    assert.deepEqual(
      validate('DeltaOp', {
        op: 'job.cancel',
        writer_group: 0,
        job_id: op.job_id,
        encounter_id: op.job_id,
        bleed_generation: 1,
      }),
      [{ path: '/bleed_body_id', code: 'missing_property' }],
    );
  });
}

// From encounter_composition.
{
  const fixture = read('protocol/fixtures/encounter_composition.json');
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
    const times = read('protocol/fixtures/resource_delivery_time.json');
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
}

// From knowledge_composition.
{
  // Break: an independent guard accepts forged success over a present-null row as first insertion.
  test('knowledge invariant refuses forged success over null visit and observation rows', () => {
    const cases = read('protocol/fixtures/knowledge_composition.json').cases;
    for (const [bad, success] of [
      ['null-visit-is-not-absence', 'entry-records-distinct-actor-room'],
      ['null-observation-is-not-absence', 'observation-retains-exact-npc-room-time'],
    ]) {
      const c = cases.find((c: any) => c.id === bad);
      const result = cases.find((c: any) => c.id === success).expected;
      assert.equal(
        check('delta_preconditions_hold', { state: c.state, delta: { ops: c.ops }, result }),
        false,
        bad,
      );
    }
  });

  // Break: the invariant accepts a counterfeit write of a skipped, stale-based or first-visit count.
  test('knowledge invariant refuses forged counted visits', () => {
    const cases = read('protocol/fixtures/knowledge_composition.json').cases;
    for (const bad of [
      'visit-count-cannot-skip',
      'stale-visit-from-refuses',
      'first-visit-has-no-count',
    ]) {
      const c = cases.find((c: any) => c.id === bad);
      const result = { changes: [{ target: c.expected.fault.target, value: c.ops[0].value }] };
      assert.equal(
        check('delta_preconditions_hold', { state: c.state, delta: { ops: c.ops }, result }),
        false,
        bad,
      );
    }
  });
}

// From water_composition.
{
  const cases = read('protocol/fixtures/water_composition.json').cases;
  // Breaks: an independent precondition checker accepts a counterfeit success with incomplete job binding.
  test('independent job invariant rejects partial actor/body/generation success', () => {
    const good = cases.find((c: any) => c.id === 'bound-expiry-occurrence');
    for (const c of cases.filter((c: any) => c.id.startsWith('missing-job-binding-'))) {
      const fake = structuredClone(good.expected);
      delete fake.changes[0].value[c.id.replace('missing-job-binding-', '')];
      assert.equal(
        check('delta_preconditions_hold', { state: c.state, delta: { ops: c.ops }, result: fake }),
        false,
        c.id,
      );
    }
  });
}

// From liquid_composition.
{
  const fixture = read('protocol/fixtures/liquid_composition.json');
  // Breaks: independent replay trusts composition, omits a Pour participant or accepts stale rows.
  test('liquid precondition replay rejects counterfeit successes and missing debit', () => {
    for (const c of fixture.cases) {
      if (c.expected.fault?.code === 'conflicting_write') continue;
      const result = c.expected.changes
        ? { changes: [] }
        : {
            changes: c.ops.map((op: any) => ({
              target: { kind: 'liquid', item_id: op.item_id },
              value: op.to,
            })),
          };
      assert.equal(
        check('delta_preconditions_hold', {
          state: c.state ?? fixture.state,
          delta: { ops: c.ops },
          result,
        }),
        false,
        c.id,
      );
    }
    const c = fixture.cases[0];
    assert.equal(
      check('delta_preconditions_hold', {
        state: fixture.state,
        delta: { ops: c.ops },
        result: { changes: [c.expected.changes[1]] },
      }),
      false,
      'receiver credit alone cannot prove a Pour',
    );
  });
}

// From population_composition.
{
  const priorCases = read('protocol/fixtures/population_composition.json').cases;

  const suppressionCases = read('protocol/fixtures/population_suppression.json').cases;
  const cases = [...priorCases, ...suppressionCases];
  // Breaks: independent precondition replay accepts a forged successful row.
  test('population invariant rejects counterfeit success', () => {
    const c = cases.find((x: { id: string }) => x.id === 'fatal-slot-and-independent-control');
    assert.equal(
      check('delta_preconditions_hold', {
        state: c.state,
        delta: { ops: c.ops },
        result: { changes: [] },
      }),
      false,
    );
  });
}

// From fuel_composition.
{
  const fixture = read('protocol/fixtures/fuel_composition.json');
  // Break: fuel writes accept stale/malformed rows, undeclared items, out-of-bounds fuel or two writers.
  test('fuel precondition replay rejects every refused write claimed as success', () => {
    for (const c of fixture.cases) {
      if (c.expected.fault?.code !== 'precondition_failed') continue;
      const counterfeit = {
        changes: c.ops.map((o: any) => ({
          target: { kind: 'fuel', item_id: o.item_id },
          value: o.to,
        })),
      };
      assert.equal(
        check('delta_preconditions_hold', {
          state: c.state,
          delta: { ops: c.ops },
          result: counterfeit,
        }),
        false,
        c.id,
      );
    }
  });
}
