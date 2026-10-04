// Expected values are hand-written in protocol/fixtures/composition.json, parsed with
// JSON.parse so they never pass through the code under test. Results are compared as
// canonical bytes, the form the Elixir kernel must match.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encode, type Json } from '../src/foundation/canonical.ts';
import { compose, current, key, LIMIT_ORDER, type State } from '../src/foundation/compose.ts';
import { check } from '../src/runtime/invariants.ts';
import { read } from './read.ts';
import { validate } from '../src/foundation/validate.ts';

const fixture = read('protocol/fixtures/composition.json');
const limits = read('docs/spec/conformance/composition-profile.json').limits;
const registered: string[] = read('protocol/invariants.json')
  .filter((i: { implemented_in: string }) => i.implemented_in === 'elixir_and_typescript')
  .map((i: { id: string }) => i.id);
const COMPOSE_INVARIANTS = [
  'one_container_per_item',
  'containment_acyclic',
  'no_last_writer_wins',
  'delta_preconditions_hold',
  'fault_discards_whole_proposal',
  'fault_codes_are_evaluation_faults',
];

// Fixture states list facts as rows; the kernel reads them indexed by canonical text.
type Row = { target?: Json; fact?: Json; value: Json };
const index = (rows: Row[] | undefined, field: 'target' | 'fact') =>
  Object.fromEntries((rows ?? []).map((r) => [key(r[field]), r.value]));
const state = (name: string): State => {
  const s = fixture.states[name] ?? built[name];
  return { ...s, facts: index(s.facts, 'target'), fact_defaults: index(s.fact_defaults, 'fact') };
};

// Boundary cases too long to list in the fixture (65 ops, 1,024 queued jobs, 40 rows): the
// inputs are built from a pattern here; each expected value is still hand-written.
const uuid = (prefix: string, n: number) =>
  `${prefix}000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const range = (n: number) => [...Array(n).keys()].map((i) => i + 1);
const HUB = '10000000-0000-4000-8000-000000000000';
const ROOM = '20000000-0000-4000-8000-000000000000';
const bram = { cartridge_id: 'lantern', cartridge_version: '0.1.0', kind: 'schedule', key: 'bram' };
const schedule = (id: string, due = 100) => ({
  op: 'job.schedule',
  writer_group: 0,
  job_id: id,
  job: bram,
  due_time: due,
});
const complete = (id: string) => ({ op: 'job.complete', writer_group: 0, job_id: id });
const queued = (due: number, status: string) => ({ job: bram, due_time: due, status });
const built: Record<string, object> = {
  full_queue: {
    clock: 6,
    jobs: Object.fromEntries(range(1024).map((n) => [uuid('f0', n), queued(3, 'pending')])),
  },
  crowd: { clock: 0, containers: Object.fromEntries(range(40).map((n) => [uuid('e0', n), HUB])) },
};
const cases = [
  ...fixture.cases,
  {
    id: 'budget-before-first-op-fault',
    state: 'base',
    ops: [schedule(uuid('d1', 0), 30), ...range(64).map((n) => schedule(uuid('f2', n)))],
    expected: { fault: { kind: 'fault', code: 'budget_exceeded' } },
  },
  {
    id: 'pending-jobs-bound-is-the-final-queue',
    state: 'full_queue',
    ops: [schedule(uuid('f1', 0), 20), complete(uuid('f0', 1))],
    expected: {
      changes: [
        { target: { kind: 'job', job_id: uuid('f0', 1) }, value: queued(3, 'completed') },
        { target: { kind: 'job', job_id: uuid('f1', 0) }, value: queued(20, 'pending') },
      ],
    },
  },
  {
    id: 'changes-sorted-by-target-over-32-rows',
    state: 'crowd',
    ops: range(40)
      .reverse()
      .map((n) => ({
        op: 'entity.transfer',
        writer_group: 0,
        entity_id: uuid('e0', n),
        source_id: HUB,
        destination_id: ROOM,
      })),
    expected: {
      changes: range(40).map((n) => ({
        target: { kind: 'containment', entity_id: uuid('e0', n) },
        value: ROOM,
      })),
    },
  },
];

test('composition known answers', () => {
  for (const c of cases) {
    const delta = { ops: c.ops };
    const result = compose(state(c.state), delta);
    assert.equal(encode(result as Json), encode(c.expected), c.id);
    for (const id of COMPOSE_INVARIANTS)
      assert.ok(check(id, { state: state(c.state), delta, result }), `${c.id}: ${id}`);
  }
});

test('invariant checks known answers, a holding and a violated case per invariant checked in both kernels', () => {
  const covered = new Set<string>();
  for (const c of fixture.invariants) {
    const obs = { ...c.observation };
    if (obs.state) obs.state = state(obs.state);
    assert.equal(check(c.id, obs), c.holds, `${c.id}: ${c.note}`);
    covered.add(`${c.id}:${c.holds}`);
  }
  for (const id of registered)
    for (const h of [true, false]) assert.ok(covered.has(`${id}:${h}`), id);
});

// Breaks: delta_preconditions_hold accepts an invalid success because it checks only each
// target's from-value, missing independent membership, lifecycle and bound rules.
test('invalid successful deltas fail their independent precondition check', () => {
  assert.equal(
    check('delta_preconditions_hold', { state: {}, delta: { ops: [] }, result: { changes: [] } }),
    false,
    'missing clock',
  );
  const ids = [
    'choice-resolve-not-offered',
    'choice-resolve-wrong-revision',
    'quest-transition-skips-objectives-complete',
    'quest-activate-while-open-in-scope',
    'capacity-all-or-nothing',
    'transfer-into-descendant',
    'resource-below-minimum-never-clamps',
    'time-advance-not-later',
    'job-schedule-at-current-time',
    'job-complete-not-due',
    'barrier-lock-while-open',
    'cooldown-start-at-not-base-clock',
  ];
  for (const id of ids) {
    const c = fixture.cases.find((x: { id: string }) => x.id === id);
    assert.ok(c, id);
    assert.equal(
      check('delta_preconditions_hold', {
        state: state(c.state),
        delta: { ops: c.ops },
        result: { changes: [] },
      }),
      false,
      id,
    );
  }
});

// Breaks: a fast cycle check ignores untouched rows, or drops capacity validation.
test('containment checks deep chains, untouched cycles and untouched capacity', () => {
  const chain = Object.fromEntries(range(5000).map((n) => [`n${n}`, `n${n + 1}`]));
  const holds = (s: object) => check('containment_acyclic', { state: s, result: { changes: [] } });
  assert.equal(holds({ containers: chain }), true);
  assert.equal(holds({ containers: { ...chain, n5001: 'n4999' } }), false);
  assert.equal(holds({ containers: { a: 'box', b: 'box' }, capacities: { box: 1 } }), false);
});

const jobId = (n: number) => uuid('d0', n);
const jobs = (n: number, due: number) =>
  Object.fromEntries(range(n).map((i) => [jobId(i), { due_time: due, status: 'pending' }]));
const over = (s: object, ops: object[]) =>
  encode(compose({ ...s, clock: 6 } as State, { ops } as never) as Json) ===
  '{"fault":{"code":"budget_exceeded","kind":"fault"}}';

const changes = (s: object, ops: object[]) =>
  (compose({ ...s, clock: 6 } as State, { ops } as never) as { changes: { value: Json }[] })
    .changes;

// Breaks: the 04 §5.4 order a tie is named in (foundation/compose.ts over) drifting from the composition
// profile's limits: a limit missing, misspelt (never checked) or moved.
test('limits are named in the composition profile order', () => {
  assert.deepEqual(LIMIT_ORDER, Object.keys(limits));
});

test('composition-profile budgets: at the limit composes with the expected changes, one over faults', () => {
  const advance = (n: number) =>
    range(n).map((i) => ({ op: 'time.advance', writer_group: 0, from: 5 + i, to: 6 + i }));
  assert.equal(
    encode(changes({}, advance(limits.operations)) as never),
    `[{"target":{"kind":"clock"},"value":${6 + limits.operations}}]`,
  );
  assert.ok(over({}, advance(limits.operations + 1)));
  assert.equal(
    changes(
      {},
      range(limits.created_jobs).map((n) => schedule(jobId(n))),
    ).length,
    limits.created_jobs,
  );
  assert.ok(
    over(
      {},
      range(limits.created_jobs + 1).map((n) => schedule(jobId(n))),
    ),
  );
  const pending = limits.pending_jobs;
  assert.equal(
    (
      changes({ jobs: jobs(pending - 1, 100) }, [schedule(jobId(pending))])[0]!.value as {
        status: string;
      }
    ).status,
    'pending',
  );
  assert.ok(over({ jobs: jobs(pending, 100) }, [schedule(jobId(pending + 1))]));
  const due = limits.due_jobs_per_advance;
  assert.equal(changes({ jobs: jobs(due, 1) }, range(due).map(jobId).map(complete)).length, due);
  assert.ok(
    over(
      { jobs: jobs(due + 1, 1) },
      range(due + 1)
        .map(jobId)
        .map(complete),
    ),
  );
});

// Review #50 A3/N1: the twin kernels agree on malformed barrier states (test/loka/core/
// compose_test.exs has the same cases). Breaks: a stored false read as unset (the initial
// state then used), or an Object.prototype name taken as a legal from-state (a throw).
test('a malformed barrier state faults precondition_failed', () => {
  const barrier = { cartridge_id: 'c', cartridge_version: '1.0.0', kind: 'barrier', key: 'd' };
  const target = { kind: 'barrier', barrier };
  const fault = { fault: { kind: 'fault', code: 'precondition_failed', target } };
  const op = (from: string) => ({
    op: 'barrier.transition',
    writer_group: 0,
    barrier,
    from,
    to: 'open',
  });
  const at = (initial: string, stored?: Json) => ({
    clock: 0,
    barrier_initial: { [key(barrier)]: initial },
    ...(stored === undefined ? {} : { barriers: { [key(target)]: stored } }),
  });
  for (const [s, from] of [
    [at('closed', false), 'closed'],
    [at('toString'), 'toString'],
  ] as const)
    assert.equal(encode(compose(s as never, { ops: [op(from)] } as never) as Json), encode(fault));
});

// Breaks: old-rate settlement, fraction retention/cap reset, zero rate, unsafe absence or malformed metadata.
test('opted recovery literal rows and independent metadata replay', () => {
  const fixture = read('protocol/fixtures/resource_recovery.json');
  for (const c of fixture.cases) {
    const spec = c.spec ?? fixture.spec;
    const s: State = {
      clock: c.clock,
      resource_specs: { [key(fixture.resource)]: spec },
      resources: c.row === null ? {} : { [key(fixture.target)]: c.row },
    };
    const ops = c.ops.map((op: object) => ({
      op: 'resource.adjust',
      writer_group: 0,
      resource: fixture.resource,
      entity_id: fixture.target.entity_id,
      ...op,
    }));
    if (c.advance !== undefined)
      ops.push({ op: 'time.advance', writer_group: 0, from: c.clock, to: c.advance });
    const delta = { ops };
    assert.deepEqual(compose(s, delta), c.expected, c.id);
    assert.equal(
      check('delta_preconditions_hold', { state: s, delta, result: c.expected }),
      true,
      c.id,
    );
    if ('fault' in c.expected) {
      assert.equal(
        check('delta_preconditions_hold', {
          state: s,
          delta,
          result: {
            changes: [
              { target: fixture.target, value: { value: 0, at: c.clock, rate: 2, remainder: 0 } },
            ],
          },
        }),
        false,
        `${c.id}: independent malformed-success control`,
      );
    } else {
      const expectedRow = c.expected.changes[0].value;
      assert.equal(
        check('delta_preconditions_hold', {
          state: s,
          delta,
          result: {
            changes: [{ target: fixture.target, value: { ...expectedRow, remainder: -1 } }],
          },
        }),
        false,
        `${c.id}: independent wrong-fraction control`,
      );
      if (c.query) {
        const before = structuredClone(expectedRow);
        assert.equal(current(expectedRow, spec, c.query.at), c.query.value, c.id);
        assert.deepEqual(expectedRow, before, `${c.id}: query preserves row`);
      }
    }
  }
});

// Breaks: independent replay accepts an unauthored stored rate when the next rate is authored.
test('independent recovery replay rejects an unauthored stored rate', () => {
  const fixture = read('protocol/fixtures/resource_recovery.json');
  const state: State = {
    clock: 64803,
    resource_specs: { [key(fixture.resource)]: fixture.spec },
    resources: { [key(fixture.target)]: { value: 0, at: 64800, rate: 3, remainder: 0 } },
  };
  const delta = {
    ops: [
      {
        op: 'resource.adjust',
        writer_group: 0,
        resource: fixture.resource,
        entity_id: fixture.target.entity_id,
        from: 0,
        to: 0,
        next_rate: 2,
      },
    ],
  };
  // Without stored-rate validation, 3 elapsed ticks at rate 3 yield value 0 and remainder 9.
  const result = {
    changes: [{ target: fixture.target, value: { value: 0, at: 64803, rate: 2, remainder: 9 } }],
  };
  assert.equal(check('delta_preconditions_hold', { state, delta, result }), false);
});

// Breaks: optional recovery schemas accept omitted table fields, unsafe/negative rates or malformed intervals.
test('recovery schema trust-boundary literals', () => {
  for (const c of read('protocol/fixtures/resource_recovery.json').contracts)
    assert.deepEqual(validate(c.contract, c.value), c.errors, c.id);
});
