import type { DeltaOp, MutationTarget } from '../contracts.gen.ts';
import { encode, type Json } from './canonical.ts';
import type { Ctx, Obj, Outcome, State } from './compose.ts';

const key = (value: unknown) => encode(value as Json);
const same = (a: unknown, b: unknown) => key(a ?? null) === key(b ?? null);
const section = (state: State, name: string): Obj => (state[name] ?? {}) as Obj;
const check = (ok: boolean, value: Json): Outcome =>
  ok ? { value } : { code: 'precondition_failed' };

export function populationRow(
  target: MutationTarget & { kind: 'population_plan' | 'population_slot' },
  state: State,
): Json | undefined {
  return target.kind === 'population_plan'
    ? section(state, 'population_plans')[key(target.plan)]
    : section(state, 'population_slots')[key(target)];
}

export function populationTransition(
  op: Extract<DeltaOp, { op: 'population.control' | 'population.slot' }>,
  row: Json | undefined,
): Outcome {
  if (op.op === 'population.control') {
    const before = row as typeof op.value | undefined;
    return check(
      same(row ?? null, op.expected) &&
        (before === undefined ||
          (op.value.next_wander_due >= before.next_wander_due &&
            ((op.value.job_id !== before.job_id &&
              same(op.value.suppression, before.suppression)) ||
              (op.value.next_wander_due === before.next_wander_due &&
                suppressionChange(before.suppression, op.value.suppression))))),
      op.value as Json,
    );
  }
  return check(same(row ?? null, op.expected) && slotValid(row, op.value), op.value as Json);
}

function suppressionChange(before: any, after: any) {
  if (!after) return false;
  if (!before || before.ends_at === null)
    return (
      after.generation === (before?.generation ?? 0) + 1 &&
      after.ends_at !== null &&
      after.job_id !== null
    );
  return (
    after.generation === before.generation &&
    after.cause_event_id === before.cause_event_id &&
    after.ends_at === null &&
    after.job_id === null
  );
}

export function initializePopulationResource(
  op: Extract<DeltaOp, { op: 'resource.initialize' }>,
  row: Json | undefined,
  ctx: Ctx,
): Outcome {
  const created = ctx.overlay.get(key({ kind: 'entity', entity_id: op.entity_id }));
  const origin = (created?.value as Obj | undefined)?.origin as Obj | undefined;
  const spec =
    origin?.kind === 'spawned'
      ? (section(ctx.state, 'population_specs')[key(origin.by)] as Obj | undefined)
      : undefined;
  return check(
    row === undefined &&
      created?.group === op.writer_group &&
      origin?.role === ((spec as Obj | undefined)?.member_role ?? 'hound') &&
      origin.member_id === op.entity_id &&
      same(op.resource, { ...(origin.by as Obj), kind: 'resource', key: 'hp' }) &&
      op.at >= ctx.state.clock &&
      op.at <= ctx.horizon &&
      op.value === (spec?.hp as Obj | undefined)?.start,
    { value: op.value, at: op.at },
  );
}

function slotValid(
  row: Json | undefined,
  next: Extract<DeltaOp, { op: 'population.slot' }>['value'],
): boolean {
  if (row === undefined)
    return (
      (next.generation === 0 &&
        next.member_id === null &&
        next.replacement_due === null &&
        next.last_flight_at == null &&
        next.sight_job_id == null) ||
      born(next)
    );
  const prior = row as typeof next;
  if (prior.generation === 0) return born(next);
  if (prior.replacement_due === null) {
    if (
      prior.member_id === null ||
      next.generation !== prior.generation ||
      next.member_id !== prior.member_id
    )
      return false;
    if (next.replacement_due !== null)
      return next.last_flight_at === prior.last_flight_at && next.sight_job_id == null;
    const changedFlight = next.last_flight_at !== prior.last_flight_at;
    const changedSight = next.sight_job_id !== prior.sight_job_id;
    return (
      (changedFlight && Number.isSafeInteger(next.last_flight_at) && next.sight_job_id == null) ||
      (!changedFlight && changedSight)
    );
  }
  return (
    next.generation === prior.generation + 1 &&
    next.member_id !== null &&
    next.member_id !== prior.member_id &&
    next.replacement_due === null &&
    next.last_flight_at == null
  );
}

function born(row: Extract<DeltaOp, { op: 'population.slot' }>['value']) {
  return (
    row.generation === 1 &&
    row.member_id !== null &&
    row.replacement_due === null &&
    row.last_flight_at == null
  );
}
