import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../src/foundation/validate.ts';
import { content, fresh, ref } from './deer_fixture.ts';

const id = '11111111-2222-4333-8444-555555555555';
const plan = content.populations![ref('population', 'willow_deer')];
const bundle = content.population_bundles![ref('population_bundle', 'willow_deer')];
const world = fresh();
const origins = Object.values(world.state.created ?? {}).map((i) => i.origin);
const deer = origins.find((o) => o.kind === 'spawned' && o.role === 'deer')! as Extract<
  (typeof origins)[number],
  { kind: 'spawned' }
>;
const hide = origins.find((o) => o.kind === 'spawned' && o.role === 'hide')! as Extract<
  (typeof origins)[number],
  { kind: 'spawned' }
>;
const slot = Object.values(world.state.population_slots ?? {}).find(
  (s) => s.member_id === deer.member_id,
)!;
const schedule = {
  op: 'job.schedule',
  writer_group: 0,
  job_id: id,
  job: {
    cartridge_id: 'ashmere_missing_child',
    cartridge_version: '0.0.36',
    kind: 'population',
    key: 'willow_deer',
  },
  due_time: 65100,
  sight: {
    member_id: deer.member_id,
    player_id: world.character,
    slot: 1,
    generation: 1,
    seen_at: 64800,
    cause_kind: 'player_entry',
    cause_id: id,
    source_id: world.roomIds[ref('room', 'reed_bank')],
    destination_id: world.roomIds[ref('room', 'willow_shade')],
  },
};
const cancel = { op: 'job.cancel', writer_group: 0, job_id: id, sight_member_id: deer.member_id };

// Breaks: the wire contract rejects a valid deer role, bound job or sight cancellation.
test('valid deer wire rows and operations remain admitted', () => {
  for (const [name, value] of [
    ['PopulationPlan', plan],
    ['PopulationBundle', bundle],
    ['EntityOrigin', deer],
    ['EntityOrigin', hide],
    ['PopulationSlot', slot],
    ['DeltaOp', schedule],
    ['DeltaOp', cancel],
  ] as const)
    assert.deepEqual(validate(name, value), [], name);
});

// Breaks: dropping a new required field or numeric/enum/pattern guard admits a malformed sight occurrence.
test('new deer wire guards refuse malformed occurrences', () => {
  const cases: [string, unknown, string, string][] = [];
  for (const field of [
    'member_id',
    'player_id',
    'slot',
    'generation',
    'seen_at',
    'cause_kind',
    'cause_id',
    'source_id',
    'destination_id',
  ]) {
    const op = structuredClone(schedule) as any;
    delete op.sight[field];
    cases.push(['DeltaOp', op, `/sight/${field}`, 'missing_property']);
  }
  for (const [field, value, code] of [
    ['slot', 0, 'below_minimum'],
    ['slot', 65, 'above_maximum'],
    ['generation', 0, 'below_minimum'],
    ['seen_at', -1, 'below_minimum'],
    ['cause_kind', 'unknown', 'not_in_enum'],
  ] as const) {
    const op = structuredClone(schedule) as any;
    op.sight[field] = value;
    cases.push(['DeltaOp', op, `/sight/${field}`, code]);
  }
  for (const [field, bad] of [
    ['member_role', 'fox'],
    ['loot_role', 'fur'],
  ] as const) {
    const b = { ...bundle, [field]: bad };
    cases.push(['PopulationBundle', b, `/${field}`, 'not_in_enum']);
  }
  const badOrigin = { ...deer, role: 'fox' };
  cases.push(['EntityOrigin', badOrigin, '/role', 'not_in_enum']);
  const badSlot = { ...slot, sight_job_id: 'bad' };
  cases.push(['PopulationSlot', badSlot, '/sight_job_id', 'pattern_mismatch']);
  const badCancel = { ...cancel, sight_member_id: 'bad' };
  cases.push(['DeltaOp', badCancel, '/sight_member_id', 'pattern_mismatch']);
  const noCause = { op: 'job.cancel', writer_group: 0, job_id: id };
  cases.push(['DeltaOp', noCause, '/encounter_id', 'missing_property']);
  for (const [field, value, code] of [
    ['delay', 0, 'below_minimum'],
    ['delay', undefined, 'missing_property'],
    ['narration', undefined, 'missing_property'],
  ] as const) {
    const p = structuredClone(plan) as any;
    if (value === undefined) delete p.sight[field];
    else p.sight[field] = value;
    cases.push(['PopulationPlan', p, `/sight/${field}`, code]);
  }
  const extraSight = structuredClone(schedule) as any;
  extraSight.sight.unrelated = true;
  cases.push(['DeltaOp', extraSight, '/sight/unrelated', 'unknown_property']);
  const extraPlanSight = structuredClone(plan) as any;
  extraPlanSight.sight.unrelated = true;
  cases.push(['PopulationPlan', extraPlanSight, '/sight/unrelated', 'unknown_property']);
  const badText = structuredClone(plan) as any;
  badText.sight.narration.south = 'Bad Text';
  cases.push(['PopulationPlan', badText, '/sight/narration/south', 'pattern_mismatch']);
  const badDirection = structuredClone(plan) as any;
  badDirection.sight.narration.sideways = 'combat.deer_fled_south';
  cases.push(['PopulationPlan', badDirection, '/sight/narration/sideways', 'pattern_mismatch']);
  for (const [contract, value, path, code] of cases)
    assert.deepEqual(validate(contract, value), [{ path, code }], `${contract}${path}`);
});
