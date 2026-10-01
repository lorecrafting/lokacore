// The proposal of one admitted decision (04 §5.1-§5.4): admission of a rule's result, its whole
// proposal (the root sequence, its due jobs and every reaction delivery in one FIFO causal
// order), composition and adoption. world.ts routes each command here.
import { encode } from './canonical.ts';
import { compose, over, target, type Fault } from './compose.ts';
import {
  CAPABILITY_OWNERS,
  LIMITS,
  type CommandId,
  type DecisionResult,
  type DeltaOp,
  type DomainEvent,
  type JobId,
} from './contracts.gen.ts';
import { allocator, COMPOSES, event, row, type Mint, type State, type World } from './decision.ts';
import { factChanged, typedFact, type Base } from './fact.ts';
import { jobCommandId } from './id_source.ts';
import { earned } from './quest.ts';
import { sequence, triggered } from './reaction.ts';
import * as schedule from './rules/schedule.ts';
import { utf8 } from './sha256.ts';
import { cmp } from './validate.ts';

export type Stepped = { decision: DecisionResult; world: World };
export type Actor = Parameters<typeof event>[1];
type Assign = Extract<DeltaOp, { op: 'fact.assign' }>;
type Corr = DomainEvent['correlation_id'];

/**
 * Proposes an admitted decision whole (propose) and composes its delta over the state, the fact
 * defaults and the declared capacities, adopting its containment, fact and clock changes; only
 * admit() makes an Admitted. A fact.assign whose fact, scope kind or value its FactSpec does not
 * allow faults precondition_failed (03 §7; 04 §5.1). A result over the events or output_bytes
 * limit faults budget_exceeded (04 §5.4). A fault discards the whole proposal.
 */
export function adopt(world: World, decision: Admitted, command: Actor, mint: Mint): Stepped {
  const out = propose(world, decision, command, mint);
  if (out.kind !== 'accepted') return { decision: out, world };
  const assigns = out.delta.ops.filter((o) => o.op === 'fact.assign') as Assign[];
  const bad = assigns.find((o) => !typedFact(world, o.fact, o.scope.kind, o.value));
  if (bad)
    return { decision: { kind: 'fault', code: 'precondition_failed', target: target(bad) }, world };
  const applied = apply(world, out.delta.ops);
  if ('fault' in applied) return { decision: applied.fault, world };
  if (
    over({ events: out.events.length }) ||
    utf8(encode(out as never)).length > LIMITS.output_bytes!
  )
    return { decision: { kind: 'fault', code: 'budget_exceeded' }, world };
  const state = { ...applied.state, rng: out.rng } as World['state'];
  return { decision: out, world: { ...world, state } };
}

// The state after composing `ops` over the world's state, the fact defaults, the declared
// capacities, the resource specs and the barriers' initial states, or composition's fault. Only
// written sections join the state, so a world that never sets a fact, resource, cooldown,
// barrier or job keeps its earlier state hash.
export function apply(world: World, ops: readonly DeltaOp[]): { state: State } | { fault: Fault } {
  const base = {
    ...world.state,
    fact_defaults: world.factDefaults,
    capacities: world.capacities,
    resource_specs: world.resourceSpecs,
    barrier_initial: world.barrierInitial,
  };
  const result = compose(base as unknown as Parameters<typeof compose>[0], { ops });
  if ('fault' in result) return result;
  // ponytail: copies each written section per call (O(rows)); persistent maps when big.
  const written: Record<string, Record<string, unknown>> = {};
  let clock = world.state.clock;
  for (const { target, value } of result.changes) {
    if (target.kind === 'clock') clock = value as number;
    const [name, at] = row(target) ?? [];
    if (!name) continue;
    written[name] ??= { ...world.state[name] };
    written[name][at!] = value;
  }
  return { state: { ...world.state, ...written, clock } as State };
}

type Queued = { cause: DomainEvent; depth: number; mint: Mint };
// A proposal being built: its ops and events so far, the queue of events awaiting their
// deliveries, the last writer group and delivery count, and `at`, the world with ops[0, applied).
type P = {
  world: World;
  command: Actor;
  ops: DeltaOp[];
  events: DomainEvent[];
  queue: Queued[];
  group: number;
  deliveries: number;
  steps: { n: number };
  at: World;
  applied: number;
};
const BUDGET = { kind: 'fault', code: 'budget_exceeded' } as Admitted;

/**
 * The whole proposal of an admitted root decision (04 §5.2 steps 4-6, §5.4), each explicit
 * sequence joining in turn: its ops, then its events, with the fact_changed of each assign that
 * changes its fact (fact.ts factChanged) at its causal position, numbered after the events before
 * them and correlated to the command; each event then queued FIFO for the reactions it triggers
 * (reaction.ts). The root sequence (writer group 0) and its deliveries to quiescence; then, when its delta has a time.advance (a wait, or a recipe's
 * duration), each due job and its reactions to quiescence before the next. One counter numbers
 * every later writer group: each job, quest delivery and reaction delivery takes the next.
 *
 * The due jobs: the pending jobs due at or before the advance's target, snapshotted from the
 * committed state and run in (due_time, job_id) order (job ids compared as UTF-8 bytes, never in
 * row order), each as its run_job (rules/schedule.ts) with the job's CommandId (id_source.ts
 * jobCommandId) and IdSource against the proposal so far, its events caused by that run_job.
 * adopt() composes the whole advance once, so final invariants, the strictly-later-than-target
 * rule for new jobs (nonfuture_job), the job budgets (budget_exceeded) and conflicts between
 * groups apply to it as one proposal, and a fault discards all of it, time included. A run_job
 * that is not accepted is the advance's result. Admission never meets an already-due job: every
 * advance drains its own, and each new job is later than the advance's target, so 04 §5.2 step 2
 * has nothing to drain.
 *
 * The deliveries of each queued event, at its FIFO position (04 §5.2 steps 5-6): first each quest
 * instance it earns (quest.ts earned: active before this decision) that is still active in the
 * proposal so far, one quest.transition to objectives_complete as its own writer group, counted
 * toward the deliveries budget; then each rule it triggers, in rule-key order, at
 * one more than its cause's reaction depth (a root's or job's events are at 0). Each counts
 * toward the deliveries budget and its `when`'s policy leaves toward query_steps, read on the
 * proposal so far at the event's logical time; only one whose `when` holds runs, as its own
 * writer group, its fact_changed caused by that event at its logical time, its ids from the
 * IdSource of the root or job that began the chain. A delivery past the deliveries,
 * reaction_depth or query_steps limit (compose.ts over) faults budget_exceeded: a cycle ends
 * there, never truncated (adopt checks the events limit on the whole proposal). ponytail: only
 * reaction guards count query_steps; root and action policies join when their callers pass
 * holds() a counter.
 * ponytail: the 04 §5.4 re-read of an entry before it runs is run_job's own status check
 * (rules/schedule.ts), and a stale entry it refuses rejects the whole advance instead of being
 * skipped as ineligible. Nothing in schedule@1 or reaction@1 cancels, reschedules or completes
 * another job, so no entry goes stale yet; the first operation that can turns that refusal into a
 * skip and adds the generation to the comparison.
 */
export function propose(world: World, root: Admitted, command: Actor, mint: Mint): Admitted {
  if (root.kind !== 'accepted') return root;
  const group = Math.max(0, ...root.delta.ops.map((o) => o.writer_group));
  const p: P = {
    world,
    command,
    ops: [],
    events: [],
    queue: [],
    group,
    deliveries: group,
    steps: { n: 0 },
    at: world,
    applied: 0,
  };
  const base = { ...cause(p, world.state.clock, command.id), actor_id: command.payload.actor_id };
  join(p, root.delta.ops, root.events, base, 0, mint);
  return react(p) ?? jobs(p, root) ?? { ...root, delta: { ops: p.ops }, events: p.events };
}

// The proposal so far, composed lazily (only a job or a delivery reads it), or its fault.
function now(p: P): World | Admitted {
  if (p.applied < p.ops.length) {
    const r = apply(p.at, p.ops.slice(p.applied));
    if ('fault' in r) return r.fault as Admitted;
    [p.at, p.applied] = [{ ...p.world, state: r.state }, p.ops.length];
  }
  return p.at;
}

// One explicit sequence joins: its ops, then its events with its fact_changed placed, numbered
// after the events before them and queued at `depth`.
function join(
  p: P,
  own: readonly DeltaOp[],
  evs: readonly DomainEvent[],
  base: Base,
  depth: number,
  m: Mint,
) {
  p.ops.push(...own);
  const assigns = own.filter((o) => o.op === 'fact.assign') as Assign[];
  for (const e of factChanged(base, m, assigns, evs)) {
    const placed = { ...e, position: p.events.length + 1, correlation_id: base.correlation_id };
    p.events.push(placed);
    p.queue.push({ cause: placed, depth, mint: m });
  }
}

// What a sequence's fact_changed share when caused by `id` at `logical_time`.
const cause = (p: P, logical_time: number, id: string) => ({
  world_context_id: p.world.context,
  logical_time,
  causation_id: id as DomainEvent['causation_id'],
  correlation_id: p.command.id as string as Corr,
});

// The queue's deliveries to quiescence, or the fault that ends them.
function react(p: P): Admitted | undefined {
  for (let next; (next = p.queue.shift());) {
    const earns = earned(p.world, next.cause.payload);
    for (const instance_id of earns) {
      const at = now(p);
      if (!('cartridge' in at)) return at;
      if (at.state.quests![instance_id]!.state !== 'active') continue;
      if (over({ deliveries: ++p.deliveries })) return BUDGET;
      const writer_group = ++p.group;
      p.ops.push({
        op: 'quest.transition',
        writer_group,
        instance_id,
        from: 'active',
        to: 'objectives_complete',
      });
    }
    for (const rule of triggered(p.world, next.cause)) {
      const at = now(p);
      if (!('cartridge' in at)) return at;
      const own = sequence(at, p.command.payload.actor_id, rule, next.cause, p.group + 1, p.steps);
      const depth = next.depth + 1;
      if (over({ deliveries: ++p.deliveries, reaction_depth: depth, query_steps: p.steps.n }))
        return BUDGET;
      if (!own) continue;
      p.group++;
      join(p, own, [], cause(p, next.cause.logical_time, next.cause.id), depth, next.mint);
    }
  }
}

// Each due job of the root's explicit advance, then its reactions, or the result that ends them.
function jobs(p: P, root: Admitted & { kind: 'accepted' }): Admitted | undefined {
  const advance = root.delta.ops.find((o) => o.op === 'time.advance');
  const due = Object.entries(advance ? (p.world.state.jobs ?? {}) : {})
    .filter(([, j]) => j.status === 'pending' && j.due_time <= advance!.to)
    .sort(([a, x], [b, y]) => x.due_time - y.due_time || cmp(a, b));
  for (const [job_id, { due_time }] of due) {
    const at = now(p);
    if (!('cartridge' in at)) return at;
    const run = {
      id: jobCommandId(job_id, due_time) as CommandId,
      world_context_id: p.world.context,
      payload: { type: 'run_job', job_id: job_id as JobId },
    } as const;
    const m = allocator(at, run);
    const ran = admit('schedule', schedule.decide(at, run, m));
    if (ran.kind !== 'accepted') return ran;
    const own = ran.delta.ops.map((o) => ({ ...o, writer_group: p.group + 1 }));
    p.group++;
    join(p, own, ran.events, cause(p, due_time, run.id), 0, m);
    const failed = react(p);
    if (failed) return failed;
  }
}

// The capability owning a command or event type; own keys only, so `constructor` names none.
export const ownerOf = (owners: Readonly<Record<string, string>>, type: string) =>
  Object.hasOwn(owners, type) ? owners[type]!.split('@')[0] : undefined;

/**
 * An accepted rule result as the host admits it (04 §5.2 step 7): an event type neither the
 * owning capability nor one it COMPOSES owns faults unowned_event, which discards the whole
 * proposal. adopt() checks the output budget once the host's events are added.
 */
export function admit(owner: string, decision: DecisionResult): Admitted {
  if (decision.kind !== 'accepted') return decision as Admitted;
  const may: readonly unknown[] = [owner, ...(COMPOSES[owner as keyof typeof COMPOSES] ?? [])];
  if (decision.events.some((e) => !may.includes(ownerOf(CAPABILITY_OWNERS.event, e.payload.type))))
    return { kind: 'fault', code: 'unowned_event' } as Admitted;
  return decision as Admitted;
}

declare const ADMITTED: unique symbol;
/** A DecisionResult that passed admit(); adopt() takes only this, so step cannot skip admit. */
export type Admitted = DecisionResult & { readonly [ADMITTED]: true };
