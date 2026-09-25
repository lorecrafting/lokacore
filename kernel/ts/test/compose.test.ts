// Expected values are hand-written in protocol/fixtures/composition.json, parsed with
// JSON.parse so they never pass through the code under test. Results are compared as
// canonical bytes, the form the Elixir kernel must match.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { encode, type Json } from '../src/canonical.ts';
import { compose, key, type State } from '../src/compose.ts';
import { check } from '../src/invariants.ts';

const read = (path: string) =>
  JSON.parse(readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8'));
const fixture = read('protocol/fixtures/composition.json');
const limits = read('docs/spec/conformance/composition-profile.json').limits;
const registered: string[] = read('protocol/invariants.json')
  .filter((i: { implemented_in: string }) => i.implemented_in === 'r3_pr5')
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

test('invariant checks known answers, a holding and a violated case per r3_pr5 invariant', () => {
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

test('published events pass no_proposed_event_escapes', () => {
  for (const { id, decision, commit, published } of fixture.publication)
    assert.ok(check('no_proposed_event_escapes', { decision, commit, published }), id);
});

// A sequenced boundary (04 §5.1, 03 §15; 14 Gate R3), test-only: compose, commit, and only
// on a confirmed commit adopt the changes and then deliver the events, each recorded in
// order. R6 replaces this with the real authority.
type Entry = [string, Json];
const step = (log: Entry[], s: State, ops: Json, events: Json[], status: string) => {
  const result = compose(s, { ops } as never) as { changes?: Json };
  if (!result.changes) return;
  log.push(['commit', status]);
  if (status !== 'committed') return;
  log.push(['adopted', result.changes]);
  for (const e of events) log.push(['delivered', e]);
};

test('failed or unknown commits and faults adopt and deliver nothing; a commit adopts, then delivers', () => {
  const byId = (section: string, id: string) =>
    fixture[section].find((c: { id: string }) => c.id === id);
  const ok = byId('cases', 'explicit-sequence-across-kinds');
  const bad = byId('cases', 'conflict-fact-opposite-groups');
  const events: Json[] = byId('publication', 'committed-publishes-committed-events').decision
    .events;
  assert.ok(events.length > 0);
  const log: Entry[] = [];
  step(log, state('base'), ok.ops, events, 'failed');
  step(log, state('base'), ok.ops, events, 'unknown');
  step(log, state('base'), bad.ops, events, 'committed');
  assert.deepEqual(log, [
    ['commit', 'failed'],
    ['commit', 'unknown'],
  ]);
  log.length = 0;
  step(log, state('base'), ok.ops, events, 'committed');
  assert.equal(
    encode(log as never),
    encode([
      ['commit', 'committed'],
      ['adopted', ok.expected.changes],
      ...events.map((e) => ['delivered', e]),
    ] as never),
  );
});

const jobId = (n: number) => uuid('d0', n);
const jobs = (n: number, due: number) =>
  Object.fromEntries(
    [...Array(n).keys()].map((i) => [jobId(i + 1), { due_time: due, status: 'pending' }]),
  );
const over = (s: object, ops: object[]) =>
  encode(compose({ ...s, clock: 6 } as State, { ops } as never) as Json) ===
  '{"fault":{"code":"budget_exceeded","kind":"fault"}}';

const changes = (s: object, ops: object[]) =>
  (compose({ ...s, clock: 6 } as State, { ops } as never) as { changes: { value: Json }[] })
    .changes;

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
