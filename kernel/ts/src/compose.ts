// StateDelta composition (04 §5.1-§5.4, 14 §R3A), twin of lib/loka/core/compose.ex, whose
// moduledoc states the base-state shape and the semantics. The base is read, never copied:
// writes go to an overlay keyed by canonical target text.
import { encode, type Json } from './canonical.ts';
import {
  LIMITS,
  type DeltaOp,
  type ErrorCode,
  type MutationTarget,
  type StateDelta,
} from './contracts.gen.ts';

type Obj = { readonly [key: string]: Json };
export type State = { readonly clock: number } & { readonly [section: string]: Json };
export type Change = { target: MutationTarget; value: Json };
export type Fault = { kind: 'fault'; code: ErrorCode; target?: MutationTarget };
export type Result = { changes: Change[] } | { fault: Fault };

type Written = { group: number; target: MutationTarget; value: Json };
type Ctx = { state: State; horizon: number; overlay: Map<string, Written> };
type Outcome = { value: Json } | { code: ErrorCode };

const LEGAL: Record<string, string[]> = {
  active: ['objectives_complete', 'failed', 'abandoned'],
  objectives_complete: ['resolved', 'failed', 'abandoned'],
  failed: ['active'],
  abandoned: ['active'],
};
const OPEN = ['active', 'objectives_complete'];

export const key = (value: unknown): string => encode(value as Json);
export const same = (a: unknown, b: unknown): boolean => key(a ?? null) === key(b ?? null);
const get = (o: Json | undefined, k: string): Json | undefined =>
  o !== null && typeof o === 'object' && !Array.isArray(o) && Object.hasOwn(o, k)
    ? (o as Obj)[k]
    : undefined;
const section = (s: State, name: string): Obj => (get(s, name) ?? {}) as Obj;
const containment = (e: string): MutationTarget =>
  ({ kind: 'containment', entity_id: e }) as MutationTarget;

/** The MutationTarget an op writes (04 §5.1). */
export function target(op: DeltaOp): MutationTarget {
  switch (op.op) {
    case 'fact.assign': {
      const t: Record<string, unknown> = { kind: 'fact', fact: op.fact, scope: op.scope };
      if (op.subject_id !== undefined) t.subject_id = op.subject_id;
      return t as MutationTarget;
    }
    case 'entity.transfer':
      return containment(op.entity_id);
    case 'quest.activate':
    case 'quest.transition':
      return { kind: 'quest', instance_id: op.instance_id };
    case 'choice.open':
    case 'choice.resolve':
    case 'choice.close':
      return { kind: 'choice', continuation_id: op.continuation_id };
    case 'job.schedule':
    case 'job.complete':
      return { kind: 'job', job_id: op.job_id };
    case 'time.advance':
      return { kind: 'clock' };
    case 'resource.adjust':
      return { kind: 'resource', resource: op.resource, entity_id: op.entity_id };
    case 'cooldown.start':
      return { kind: 'cooldown', actor_id: op.actor_id, action: op.action };
  }
}

/** A resource's stored row: its value and the time it was stored (delta.schema.json). */
export type Stored = { readonly value: number; readonly at: number };
type Spec = {
  readonly maximum: number;
  readonly minimum: number;
  readonly start: number;
  readonly gain: number;
};

/**
 * A resource's current value at `now` (ResourceSpec regeneration): the stored value (start at
 * time 0 when unset) plus gain for each hour boundary crossed since it was stored, stopping at
 * maximum. A product past 2^53 is inexact but still above maximum, so the result is exact.
 */
export function current(row: Stored | undefined, spec: Spec, now: number): number {
  const { value, at } = row ?? { value: spec.start, at: 0 };
  const ticks = Math.floor(now / 3600) - Math.floor(at / 3600);
  return Math.min(spec.maximum, value + spec.gain * ticks);
}

export function compose(state: State, delta: StateDelta): Result {
  const { ops } = delta;
  if (typeof state.clock !== 'number') return fault('precondition_failed', { kind: 'clock' });
  if (overBudget(state, ops)) return { fault: { kind: 'fault', code: 'budget_exceeded' } };
  let horizon = state.clock;
  for (const op of ops) if (op.op === 'time.advance') horizon = op.to;
  const ctx: Ctx = { state, horizon, overlay: new Map() };
  for (const op of ops) {
    const t = target(op);
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

function overBudget(state: State, ops: readonly DeltaOp[]): boolean {
  const count = (name: string) => ops.filter((o) => o.op === name).length;
  const jobs = Object.values(section(state, 'jobs'));
  const pending = jobs.filter((j) => get(j, 'status') === 'pending').length;
  const created = count('job.schedule');
  const due = count('job.complete');
  return (
    ops.length > LIMITS.operations! ||
    created > LIMITS.created_jobs! ||
    due > LIMITS.due_jobs_per_advance! ||
    pending + created - due > LIMITS.pending_jobs!
  );
}

const fault = (code: ErrorCode, t: MutationTarget): Result => ({
  fault: { kind: 'fault', code, target: t },
});
const check = (ok: boolean, value: Json): Outcome =>
  ok ? { value } : { code: 'precondition_failed' };
const put = (row: Json | undefined, extra: Obj): Json => ({ ...((row ?? {}) as Obj), ...extra });

function apply(op: DeltaOp, t: MutationTarget, ctx: Ctx): Outcome {
  const row = read(t, ctx);
  switch (op.op) {
    case 'fact.assign': {
      const now = row ?? get(section(ctx.state, 'fact_defaults'), key(op.fact));
      return check(now !== undefined && same(now, op.expected), op.value);
    }
    case 'entity.transfer':
      return transfer(op.entity_id, op.source_id, op.destination_id, row, ctx);
    case 'quest.activate':
    case 'quest.transition':
      return quest(op, row, ctx);
    case 'choice.open':
    case 'choice.resolve':
    case 'choice.close':
      return choice(op, row);
    case 'job.schedule':
      if (row !== undefined) return { code: 'precondition_failed' };
      if (op.due_time <= ctx.horizon) return { code: 'nonfuture_job' };
      return { value: { job: op.job, due_time: op.due_time, status: 'pending' } as Json };
    case 'job.complete': {
      const ok =
        get(row, 'status') === 'pending' && (get(row, 'due_time') as number) <= ctx.horizon;
      return check(ok, put(row, { status: 'completed' }));
    }
    case 'time.advance':
      return check(row === op.from && op.to > op.from, op.to);
    case 'resource.adjust': {
      const spec = get(section(ctx.state, 'resource_specs'), key(op.resource)) as Spec | undefined;
      const ok =
        spec !== undefined &&
        current(row as Stored | undefined, spec, ctx.state.clock) === op.from &&
        op.to >= spec.minimum &&
        op.to <= spec.maximum;
      return check(ok, { value: op.to, at: ctx.state.clock });
    }
    case 'cooldown.start':
      return check(same(row, op.from) && op.at === ctx.state.clock, op.at);
  }
}

function choice(op: DeltaOp & { op: `choice.${string}` }, row: Json | undefined): Outcome {
  switch (op.op) {
    case 'choice.open': {
      const { actor_id, source, beat, roles, choice_ids } = op;
      const opened = { actor_id, source, beat, roles, choice_ids, status: 'pending' };
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

function quest(op: DeltaOp & { op: `quest.${string}` }, row: Json | undefined, ctx: Ctx): Outcome {
  if (op.op === 'quest.activate') {
    const taken = rows('quest', 'quests', 'instance_id', ctx).some(
      ([, r]) =>
        same(get(r, 'quest'), op.quest) &&
        same(get(r, 'scope'), op.scope) &&
        OPEN.includes(get(r, 'state') as string),
    );
    const created = { quest: op.quest, scope: op.scope, state: 'active' };
    return check(row === undefined && !taken, created as unknown as Json);
  }
  const outcomeOk =
    op.to === 'resolved'
      ? op.outcome !== undefined
      : op.to === 'failed' || op.outcome === undefined;
  const { outcome: _, ...rest } = (row ?? {}) as Obj;
  const next = op.outcome === undefined ? rest : { ...rest, outcome: op.outcome };
  const legal = (LEGAL[op.from] ?? []).includes(op.to);
  return check(get(row, 'state') === op.from && legal && outcomeOk, { ...next, state: op.to });
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

// The overlay's value for a target, else the base's.
function read(t: MutationTarget, ctx: Ctx): Json | undefined {
  const w = ctx.overlay.get(key(t));
  if (w) return w.value;
  const s = ctx.state;
  switch (t.kind) {
    case 'fact':
      return get(section(s, 'facts'), key(t));
    case 'containment':
      return get(section(s, 'containers'), t.entity_id);
    case 'quest':
      return get(section(s, 'quests'), t.instance_id);
    case 'choice':
      return get(section(s, 'choices'), t.continuation_id);
    case 'job':
      return get(section(s, 'jobs'), t.job_id);
    case 'clock':
      return s.clock;
    case 'resource':
      return get(section(s, 'resources'), key(t));
    case 'cooldown':
      return get(section(s, 'cooldowns'), key(t));
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
