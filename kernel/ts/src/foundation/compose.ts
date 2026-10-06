import { choice, pendingAtLimit } from './compose_choice.ts';
import { composeLiquid } from './compose_liquid.ts';
import { transitionBleed } from './compose_bleed.ts';
import { quest, repeatPair } from './compose_quest.ts';
import { composeFuel } from './fuel.ts';
import { transitionPatrol } from './compose_patrol.ts';
import { transitionExpedition } from './compose_expedition.ts';
import { transitionEscort } from './compose_escort.ts';
import { populationTransition, initializePopulationResource } from './compose_population.ts';
import { packMemberRemains, packMemberInitiallyPresent } from './compose_pack.ts';
import { openEncounter, changeEncounter } from './compose_encounter.ts';
import { composeJob } from './compose_job.ts';
import { target } from './compose_target.ts';
import { completeBirths, creationValid, initialPair, initialPlacement } from './creation.ts';
import { sightHandoffValid } from './compose_sight.ts';
import { sightRebindValid } from './compose_sight_rebind.ts';
import type { Json } from './canonical.ts';
import { key, get, section, containment, read, rows } from './compose_rows.ts';
import { composeAdjustment } from './resource.ts';
import {
  LIMITS,
  type DeltaOp,
  type ErrorCode,
  type MutationTarget,
  type StateDelta,
} from '../contracts.gen.ts';
import { transitionWater } from './compose_water.ts';
export type Obj = { readonly [key: string]: Json };
export type State = { readonly clock: number } & { readonly [section: string]: Json };
export type Change = { target: MutationTarget; value: Json };
export type Fault = { kind: 'fault'; code: ErrorCode; target?: MutationTarget };
export type Result = { changes: Change[] } | { fault: Fault };

export type Written = { group: number; target: MutationTarget; value: Json };
export type Ctx = { state: State; horizon: number; overlay: Map<string, Written> };
export type Outcome = { value: Json } | { code: ErrorCode };
const DOOR: Record<string, string[]> = {
  closed: ['open', 'locked'],
  open: ['closed'],
  locked: ['closed'],
};
export { key, get } from './compose_rows.ts';
export const same = (a: unknown, b: unknown): boolean => key(a ?? null) === key(b ?? null);
export { target } from './compose_target.ts';
export { current, type Stored } from './resource.ts';
export function compose(state: State, delta: StateDelta, final = true): Result {
  const { ops } = delta;
  if (typeof state.clock !== 'number') return fault('precondition_failed', { kind: 'clock' });
  if (over(counts(state, ops))) return { fault: { kind: 'fault', code: 'budget_exceeded' } };
  let horizon = state.clock;
  for (const op of ops) if (op.op === 'time.advance') horizon = op.to;
  const ctx: Ctx = { state, horizon, overlay: new Map() };
  for (const [index, op] of ops.entries()) {
    const t = target(op);
    if (!initialPair(op, ops[index + 1]) || !repeatPair(op, ops[index + 1]))
      return fault('precondition_failed', t);
    const k = key(t);
    const prior = ctx.overlay.get(k);
    if (
      prior &&
      prior.group !== op.writer_group &&
      !sightRebindValid(state, ops, index, prior.group)
    )
      return fault('conflicting_write', t);
    const out = apply(op, read(t, ctx), ctx);
    if ('code' in out) return fault(out.code, t);
    ctx.overlay.set(k, { group: op.writer_group, target: t, value: out.value });
  }
  for (const w of ctx.overlay.values())
    if (w.target.kind === 'choice' && pendingAtLimit(w.value))
      return fault('precondition_failed', w.target);
  if (final && (!completeBirths(ops, state) || !sightHandoffValid(state, ops)))
    return fault('precondition_failed', { kind: 'clock' });
  const rows = [...ctx.overlay].sort(([a], [b]) => (a < b ? -1 : 1));
  return { changes: rows.map(([, w]) => ({ target: w.target, value: w.value })) };
}

export function counts(state: State, ops: readonly DeltaOp[]) {
  const count = (name: string) => ops.filter((o) => o.op === name).length;
  const jobs = Object.values(section(state, 'jobs'));
  const pending = jobs.filter((j) => get(j, 'status') === 'pending').length;
  return {
    operations: ops.length,
    created_jobs: count('job.schedule'),
    due_jobs_per_advance: count('job.complete'),
    pending_jobs: pending + count('job.schedule') - count('job.complete') - count('job.cancel'),
  };
}

export type Limit = keyof typeof LIMITS;
export const LIMIT_ORDER = (
  'operations query_steps events deliveries reaction_depth selector_cardinality created_jobs ' +
  'pending_jobs due_jobs_per_advance scene_auto_advances output_bytes'
).split(' ') as Limit[];

export const over = (counts: Partial<Record<Limit, number>>): Limit | undefined =>
  LIMIT_ORDER.find((k) => counts[k]! > LIMITS[k]);

const fault = (code: ErrorCode, t: MutationTarget): Result => ({
  fault: { kind: 'fault', code, target: t },
});
export const check = (ok: boolean, value: Json): Outcome =>
  ok ? { value } : { code: 'precondition_failed' };
const put = (row: Json | undefined, extra: Obj): Json => ({ ...((row ?? {}) as Obj), ...extra });

function apply(op: DeltaOp, row: Json | undefined, ctx: Ctx): Outcome {
  if ('continuation_id' in op)
    return choice(op, row, section(ctx.state, 'choices')[op.continuation_id]);
  if (op.op === 'liquid.set') return composeLiquid(op, row, ctx.state);
  if (op.op === 'fuel.set') return composeFuel(op, row, ctx.state);
  if (op.op === 'entity.create') return createEntity(op, row, ctx.state);
  if (op.op === 'bleed.transition')
    return transitionBleed(op, row, ctx.state, ctx.horizon, ctx.overlay);
  switch (op.op) {
    case 'fact.assign':
      return assign(op, row, ctx);
    case 'entity.transfer':
      return transferOp(op, row, ctx);
    case 'quest.activate':
    case 'quest.retire':
    case 'quest.transition':
      return quest(op, row, () => rows('quest', 'quests', 'instance_id', ctx));
    case 'job.schedule':
    case 'job.complete':
    case 'job.cancel':
      return composeJob(op, row, ctx.horizon);
    case 'encounter.open':
    case 'encounter.advance':
    case 'encounter.close':
      return encounter(op, row, ctx);
    case 'patrol.transition':
      return transitionPatrol(op, row);
    case 'expedition.transition':
      return transitionExpedition(op, row);
  }
  return applyWorld(op, row, ctx);
}

function applyWorld(
  op: Extract<
    DeltaOp,
    {
      op:
        | 'population.control'
        | 'population.slot'
        | 'water.transition'
        | 'escort.transition'
        | 'time.advance'
        | 'resource.adjust'
        | 'resource.initialize'
        | 'cooldown.start'
        | 'barrier.transition';
    }
  >,
  row: Json | undefined,
  ctx: Ctx,
): Outcome {
  switch (op.op) {
    case 'population.control':
    case 'population.slot':
      return populationTransition(op, row);
    case 'water.transition':
      return transitionWater(op, row, ctx.state, read(containment(op.value.body_id), ctx));
    case 'escort.transition':
      return transitionEscort(op, row);
    case 'time.advance':
      return check(row === op.from && op.to > op.from, op.to);
    case 'resource.adjust':
      return composeAdjustment(op, row, ctx.state, ctx.horizon);
    case 'resource.initialize':
      return initializePopulationResource(op, row, ctx);
    case 'cooldown.start':
      return check(same(row, op.from) && op.at === ctx.state.clock, op.at);
    case 'barrier.transition':
      return barrier(op, row, ctx);
  }
}

function createEntity(
  op: Extract<DeltaOp, { op: 'entity.create' }>,
  row: Json | undefined,
  state: State,
): Outcome {
  return check(
    row === undefined && creationValid(op.identity as unknown as Json, state),
    op.identity as Json,
  );
}

function encounter(
  op: DeltaOp & { op: `encounter.${string}` },
  row: Json | undefined,
  ctx: Ctx,
): Outcome {
  if (op.op !== 'encounter.open')
    return changeEncounter(
      op,
      row,
      (id, room) =>
        packMemberRemains(
          id,
          room,
          op.writer_group,
          get(section(ctx.state, 'jobs')[op.job_id], 'due_time'),
          ctx,
        ),
      (id, room) => packMemberInitiallyPresent(id, room, ctx.state),
    );
  return openEncounter(
    op,
    row,
    ctx.state,
    read(containment(op.body_id), ctx),
    read(containment(op.npc_id), ctx),
    rows('encounter', 'encounters', 'encounter_id', ctx),
  );
}

function transferOp(
  op: DeltaOp & { op: 'entity.transfer' },
  row: Json | undefined,
  ctx: Ctx,
): Outcome {
  if (op.source_id !== null) return transfer(op, row, ctx);
  const created = ctx.overlay.get(key({ kind: 'entity', entity_id: op.entity_id }));
  const parent = ctx.overlay.get(key({ kind: 'entity', entity_id: op.destination_id }));
  return check(
    initialPlacement(op, row, created?.group, ctx.state, parent?.value, created?.value),
    op.destination_id,
  );
}

function transfer(
  op: Extract<DeltaOp, { op: 'entity.transfer' }>,
  row: Json | undefined,
  ctx: Ctx,
): Outcome {
  const { entity_id: e, source_id: source, destination_id: d } = op;
  if (source === null) return { code: 'precondition_failed' };
  const known = section(ctx.state, 'known_entities') as Record<string, Obj>;
  if (
    known[e]?.kind === 'consumed' ||
    known[source]?.kind === 'consumed' ||
    (known[d]?.kind === 'consumed' &&
      (known[e]?.kind !== 'item' ||
        known[source]?.kind !== 'body' ||
        (op.consumption === 'bandaged'
          ? known[e]?.bandage !== true
          : known[e]?.edible !== true))) ||
    (op.consumption === 'bandaged' && known[d]?.kind !== 'consumed')
  )
    return { code: 'precondition_failed' };
  if (row !== source) return { code: 'precondition_failed' };
  if (inside(d, e, ctx)) return { code: 'containment_cycle' };
  const cap = get(section(ctx.state, 'capacities'), d) as number | undefined;
  if (cap === undefined) return { value: d };
  const held = rows('containment', 'containers', 'entity_id', ctx).filter(
    ([x, c]) => c === d && x !== e,
  );
  if (held.length >= cap) return { code: 'capacity_exceeded' };
  return { value: d };
}

// d is e or inside it. Revisiting a container means a cyclic base: fail closed.
function inside(d: string, e: string, ctx: Ctx): boolean {
  const seen = new Set<Json>();
  for (let at: Json | undefined = d; at !== undefined; at = read(containment(at as string), ctx)) {
    if (at === e || seen.has(at)) return true;
    seen.add(at);
  }
  return false;
}

function barrier(
  op: DeltaOp & { op: 'barrier.transition' },
  row: Json | undefined,
  ctx: Ctx,
): Outcome {
  const now = row ?? get(section(ctx.state, 'barrier_initial'), key(op.barrier));
  return check(
    now === op.from && Object.hasOwn(DOOR, op.from) && DOOR[op.from].includes(op.to),
    op.to,
  );
}

function assign(op: Extract<DeltaOp, { op: 'fact.assign' }>, row: Json | undefined, ctx: Ctx) {
  const now = row ?? get(section(ctx.state, 'fact_defaults'), key(op.fact));
  return check(now !== undefined && same(now, op.expected), op.value);
}
