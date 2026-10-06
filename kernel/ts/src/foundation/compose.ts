import { quest, repeatPair } from './compose_quest.ts';
import { composeFuel } from './fuel.ts';
import { transitionPatrol } from './compose_patrol.ts';
import { transitionEscort } from './compose_escort.ts';
import { openEncounter, changeEncounter, composeJob } from './compose_encounter.ts';
import { target } from './compose_target.ts';
// StateDelta composition, twin of lib/loka/core/compose.ex; writes use a target-keyed overlay.
import { creationValid, initialPair, initialPlacement } from './creation.ts';
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

type Written = { group: number; target: MutationTarget; value: Json };
type Ctx = { state: State; horizon: number; overlay: Map<string, Written> };
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
export function compose(state: State, delta: StateDelta): Result {
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
    const out = apply(op, t, ctx);
    if ('code' in out) return fault(out.code, t);
    ctx.overlay.set(k, { group: op.writer_group, target: t, value: out.value });
  }
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

// size: allow 44, exhaustive dispatch over the closed delta-op contract
function apply(op: DeltaOp, t: MutationTarget, ctx: Ctx): Outcome {
  const row = read(t, ctx);
  switch (op.op) {
    case 'fact.assign':
      return assign(op, row, ctx);
    case 'entity.create':
      return check(
        row === undefined && creationValid(op.identity as unknown as Json, ctx.state),
        op.identity as Json,
      );
    case 'entity.transfer':
      return transferOp(op, row, ctx);
    case 'quest.activate':
    case 'quest.retire':
    case 'quest.transition':
      return quest(op, row, () => rows('quest', 'quests', 'instance_id', ctx));
    case 'choice.open':
    case 'choice.resolve':
    case 'choice.close':
      return choice(op, row);
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
    case 'escort.transition':
      return transitionEscort(op, row);
    case 'time.advance':
      return check(row === op.from && op.to > op.from, op.to);
    case 'fuel.set':
      return composeFuel(op, row, ctx.state);
    case 'resource.adjust':
      return composeAdjustment(op, row, ctx.state, ctx.horizon);
    case 'cooldown.start':
      return check(same(row, op.from) && op.at === ctx.state.clock, op.at);
    case 'barrier.transition':
      return barrier(op, row, ctx);
  }
}

function encounter(
  op: DeltaOp & { op: `encounter.${string}` },
  row: Json | undefined,
  ctx: Ctx,
): Outcome {
  if (op.op !== 'encounter.open') return changeEncounter(op, row);
  return openEncounter(
    op,
    row,
    ctx.state,
    read(containment(op.body_id), ctx),
    read(containment(op.npc_id), ctx),
    rows('encounter', 'encounters', 'encounter_id', ctx),
  );
}

function choice(op: DeltaOp & { op: `choice.${string}` }, row: Json | undefined): Outcome {
  switch (op.op) {
    case 'choice.open': {
      const { actor_id, source, beat, roles, choice_ids } = op;
      const opened = { actor_id, source, beat, roles, choice_ids, status: 'pending' };
      if (op.quest_instance_id) Object.assign(opened, { quest_instance_id: op.quest_instance_id });
      return check(row === undefined, opened as unknown as Json);
    }
    case 'choice.resolve': {
      const offered =
        get(row, 'status') === 'pending' &&
        (get(row, 'choice_ids') as string[]).includes(op.choice_id);
      const ok = offered && get(row, 'opened_revision') === op.expected_revision;
      return check(ok, put(row, { status: 'resolved', choice_id: op.choice_id }));
    }
    default:
      return check(get(row, 'status') === 'pending', put(row, { status: 'closed' }));
  }
}

function transferOp(
  op: DeltaOp & { op: 'entity.transfer' },
  row: Json | undefined,
  ctx: Ctx,
): Outcome {
  if (op.source_id !== null)
    return transfer(op.entity_id, op.source_id, op.destination_id, row, ctx);
  const created = ctx.overlay.get(key({ kind: 'entity', entity_id: op.entity_id }));
  return check(initialPlacement(op, row, created?.group, ctx.state), op.destination_id);
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
