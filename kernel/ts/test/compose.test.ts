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
  const s = fixture.states[name];
  return { ...s, facts: index(s.facts, 'target'), fact_defaults: index(s.fact_defaults, 'fact') };
};

test('composition known answers', () => {
  for (const c of fixture.cases) {
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

const jobId = (n: number) => `d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const jobs = (n: number, due: number) =>
  Object.fromEntries(
    [...Array(n).keys()].map((i) => [jobId(i + 1), { due_time: due, status: 'pending' }]),
  );
const range = (n: number) => [...Array(n).keys()].map((i) => i + 1);
const bram = { cartridge_id: 'lantern', cartridge_version: '0.1.0', kind: 'schedule', key: 'bram' };
const schedule = (n: number) => ({
  job: bram,
  op: 'job.schedule',
  writer_group: 0,
  job_id: jobId(n),
  due_time: 100,
});
const complete = (n: number) => ({ op: 'job.complete', writer_group: 0, job_id: jobId(n) });
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
  assert.equal(changes({}, range(limits.created_jobs).map(schedule)).length, limits.created_jobs);
  assert.ok(over({}, range(limits.created_jobs + 1).map(schedule)));
  const pending = limits.pending_jobs;
  assert.equal(
    (changes({ jobs: jobs(pending - 1, 100) }, [schedule(pending)])[0]!.value as { status: string })
      .status,
    'pending',
  );
  assert.ok(over({ jobs: jobs(pending, 100) }, [schedule(pending + 1)]));
  const due = limits.due_jobs_per_advance;
  assert.equal(changes({ jobs: jobs(due, 1) }, range(due).map(complete)).length, due);
  assert.ok(over({ jobs: jobs(due + 1, 1) }, range(due + 1).map(complete)));
});
