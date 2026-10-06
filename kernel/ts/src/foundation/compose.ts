import { choice, pendingAtLimit } from './compose_choice.ts';
import { composeLiquid } from './compose_liquid.ts';
import { quest, repeatPair } from './compose_quest.ts';
import { composeFuel } from './fuel.ts';
import { transitionPatrol } from './compose_patrol.ts';
import { transitionEscort } from './compose_escort.ts';
import {
  populationTransition,
  initializePopulationResource,
  populationRow,
} from './compose_population.ts';
import { openEncounter, changeEncounter, composeJob } from './compose_encounter.ts';
import { target } from './compose_target.ts';
// StateDelta composition, twin of lib/loka/core/compose.ex; writes use a target-keyed overlay.
import { completeBirths, creationValid, initialPair, initialPlacement } from './creation.ts';
import { encode, type Json } from './canonical.ts';
import { composeAdjustment } from './resource.ts';
import {
  LIMITS,
  type DeltaOp,
  type ErrorCode,
  type MutationTarget,
  type StateDelta,
} from '../contracts.gen.ts';

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

export const key = (value: unknown): string => encode(value as Json);
export const same = (a: unknown, b: unknown): boolean => key(a ?? null) === key(b ?? null);
export const get = (o: Json | undefined, k: string): Json | undefined =>
  o !== null && typeof o === 'object' && !Array.isArray(o) && Object.hasOwn(o, k)
    ? (o as Obj)[k]
    : undefined;
const section = (s: State, name: string): Obj => (get(s, name) ?? {}) as Obj;
const containment = (e: string): MutationTarget =>
  ({ kind: 'containment', entity_id: e }) as MutationTarget;

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
    if (prior && prior.group !== op.writer_group) return fault('conflicting_write', t);
    const out = apply(op, read(t, ctx), ctx);
    if ('code' in out) return fault(out.code, t);
    ctx.overlay.set(k, { group: op.writer_group, target: t, value: out.value });
  }
  for (const w of ctx.overlay.values())
    if (w.target.kind === 'choice' && pendingAtLimit(w.value))
      return fault('precondition_failed', w.target);
  if (final && !completeBirths(ops, state)) return fault('precondition_failed', { kind: 'clock' });
  const rows = [...ctx.overlay].sort(([a], [b]) => (a < b ? -1 : 1));
  return { changes: rows.map(([, w]) => ({ target: w.target, value: w.value })) };
}

/** `ops`' operation and job counts over `state`, the composition-profile limits compose checks. */
export function counts(state: State, ops: readonly DeltaOp[]) {
  const count = (name: string) => ops.filter((o) => o.op === name).length;
  const jobs = Object.values(section(state, 'jobs'));
  const pending = jobs.filter((j) => get(j, 'status') === 'pending').length;
  const created = count('job.schedule');
  const due = count('job.complete');
  return {
    operations: ops.length,
    created_jobs: created,
    due_jobs_per_advance: due,
    pending_jobs: pending + created - due - count('job.cancel'),
  };
}

export type Limit = keyof typeof LIMITS;
export const LIMIT_ORDER = (
  'operations query_steps events deliveries reaction_depth selector_cardinality created_jobs ' +
  'pending_jobs due_jobs_per_advance scene_auto_advances output_bytes'
).split(' ') as Limit[];

/** First exceeded aggregate budget in composition-profile order (04 §5.4). */
export const over = (counts: Partial<Record<Limit, number>>): Limit | undefined =>
  LIMIT_ORDER.find((k) => counts[k]! > LIMITS[k]);

const fault = (code: ErrorCode, t: MutationTarget): Result => ({
  fault: { kind: 'fault', code, target: t },
});
export const check = (ok: boolean, value: Json): Outcome =>
  ok ? { value } : { code: 'precondition_failed' };
const put = (row: Json | undefined, extra: Obj): Json => ({ ...((row ?? {}) as Obj), ...extra });

// size: allow 44, exhaustive dispatch over closed liquid, choice and patrol operations
function apply(op: DeltaOp, row: Json | undefined, ctx: Ctx): Outcome {
  if ('continuation_id' in op)
    return choice(op, row, section(ctx.state, 'choices')[op.continuation_id]);
  if (op.op === 'liquid.set') return composeLiquid(op, row, ctx.state);
  if (op.op === 'entity.create') return createEntity(op, row, ctx.state);
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
    case 'population.control':
    case 'population.slot':
      return populationTransition(op, row);
    case 'escort.transition':
      return transitionEscort(op, row);
    case 'time.advance':
      return check(row === op.from && op.to > op.from, op.to);
    case 'fuel.set':
      return composeFuel(op, row, ctx.state);
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

function packMemberRemains(
  id: string,
  room: string,
  group: number,
  due: Json | undefined,
  ctx: Ctx,
): boolean {
  const origin = get(section(ctx.state, 'created')[id], 'origin') as Obj | undefined;
  if (origin?.kind !== 'spawned' || !packMemberInitiallyPresent(id, room, ctx.state)) return false;
  const target = {
    kind: 'population_slot',
    plan: origin.by as never,
    slot: origin.slot as number,
  } as const;
  const before = populationRow(target, ctx.state);
  const slot = read(target, ctx);
  const current =
    read(containment(id), ctx) === room &&
    get(slot, 'member_id') === id &&
    get(slot, 'generation') === origin.generation &&
    get(slot, 'replacement_due') === null;
  if (current) return true;
  const slotWrite = ctx.overlay.get(key(target));
  const moved = ctx.overlay.get(key(containment(id)));
  const hp = ctx.overlay.get(
    key({
      kind: 'resource',
      entity_id: id,
      resource: { ...(origin.by as Obj), kind: 'resource', key: 'hp' },
    }),
  );
  const flew =
    moved?.group === group &&
    moved.value !== room &&
    slotWrite?.group === group &&
    Number.isSafeInteger(due) &&
    get(slot, 'last_flight_at') === due &&
    get(before, 'last_flight_at') !== due &&
    get(slot, 'replacement_due') === null;
  const died =
    slotWrite?.group === group &&
    hp?.group === group &&
    get(slot, 'replacement_due') !== null &&
    get(hp.value, 'value') === 0;
  return !(flew || died);
}

function packMemberInitiallyPresent(id: string, room: string, state: State): boolean {
  const origin = get(section(state, 'created')[id], 'origin') as Obj | undefined;
  if (origin?.kind !== 'spawned') return false;
  const slot = populationRow(
    { kind: 'population_slot', plan: origin.by as never, slot: origin.slot as number },
    state,
  );
  return (
    section(state, 'containers')[id] === room &&
    get(slot, 'member_id') === id &&
    get(slot, 'generation') === origin.generation &&
    get(slot, 'replacement_due') === null
  );
}

function transferOp(
  op: DeltaOp & { op: 'entity.transfer' },
  row: Json | undefined,
  ctx: Ctx,
): Outcome {
  if (op.source_id !== null)
    return transfer(op.entity_id, op.source_id, op.destination_id, row, ctx);
  const created = ctx.overlay.get(key({ kind: 'entity', entity_id: op.entity_id }));
  const parent = ctx.overlay.get(key({ kind: 'entity', entity_id: op.destination_id }));
  return check(
    initialPlacement(op, row, created?.group, ctx.state, parent?.value, created?.value),
    op.destination_id,
  );
}

function transfer(e: string, source: string, d: string, row: Json | undefined, ctx: Ctx): Outcome {
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

function read(t: MutationTarget, ctx: Ctx): Json | undefined {
  const w = ctx.overlay.get(key(t));
  if (w) return w.value;
  const s = ctx.state;
  if (t.kind === 'population_plan' || t.kind === 'population_slot') return populationRow(t, s);
  switch (t.kind) {
    case 'fact':
      return get(section(s, 'facts'), key(t));
    case 'entity':
      return get(section(s, 'created'), t.entity_id);
    case 'containment':
      return get(section(s, 'containers'), t.entity_id);
    case 'quest':
      return get(section(s, 'quests'), t.instance_id);
    case 'choice':
      return get(section(s, 'choices'), t.continuation_id);
    case 'job':
      return get(section(s, 'jobs'), t.job_id);
    case 'encounter':
      return get(section(s, 'encounters'), t.encounter_id);
    case 'patrol':
      return get(section(s, 'patrols'), t.quest_instance_id);
    case 'escort':
      return get(section(s, 'escorts'), t.actor_id);
    case 'liquid':
      return get(section(s, 'liquids'), t.item_id);
    case 'clock':
      return s.clock;
    case 'fuel':
      return get(section(s, 'fuel'), t.item_id);
    case 'resource':
      return get(section(s, 'resources'), key(t));
    case 'cooldown':
      return get(section(s, 'cooldowns'), key(t));
    case 'barrier':
      return get(section(s, 'barriers'), key(t));
  }
}

// ponytail: scans the whole section; add a contents/scope index when a cartridge has many rows.
function rows(kind: string, name: string, id: string, ctx: Ctx): [string, Json][] {
  const changed = new Map<string, Json>();
  for (const w of ctx.overlay.values())
    if (w.target.kind === kind) changed.set(get(w.target as Json, id) as string, w.value);
  const base = Object.entries(section(ctx.state, name)).filter(([k]) => !changed.has(k));
  return [...base, ...changed];
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
