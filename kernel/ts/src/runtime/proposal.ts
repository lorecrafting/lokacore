// The proposal of one admitted decision (04 §5.1-§5.4): admission of a rule's result, its whole
// proposal (the root sequence, its due jobs and every reaction delivery in one FIFO causal
// order), composition and adoption. runtime/world.ts routes each command here.
import { encode } from '../foundation/canonical.ts';
import { apply, base } from './apply.ts';
import { counts, over, target, type Limit } from '../foundation/compose.ts';
import {
  CAPABILITY_OWNERS,
  type CommandId,
  type DecisionResult,
  type DeltaOp,
  type DomainEvent,
  type JobId,
  type QuestInstanceId,
  type Text,
} from '../contracts.gen.ts';
import { allocator, COMPOSES, event, type Mint, type Steps, type World } from './decision.ts';
import { factChanged, typedFact, type Base } from '../mechanics/fact.ts';
import { jobCommandId } from '../foundation/id_source.ts';
import { earned } from '../mechanics/quest/lifecycle.ts';
import { sequence, triggered } from '../mechanics/reaction.ts';
import * as schedule from '../mechanics/schedule/rule.ts';
import { utf8 } from '../foundation/sha256.ts';
import { cmp } from '../foundation/validate.ts';
import { currentRound } from '../mechanics/combat/round.ts';
import { deathCredit } from '../mechanics/combat/credit.ts';
import { recoveryFault } from '../mechanics/resource.ts';

// limit: a budget_exceeded fault's exhausted limit, a side value never in the result (04 §5.4).
export type Stepped = { decision: DecisionResult; world: World; limit?: Limit };
export type Actor = Parameters<typeof event>[1];
type Assign = Extract<DeltaOp, { op: 'fact.assign' }>;
type Corr = DomainEvent['correlation_id'];

/** Compose one admitted proposal atomically. Validate typed facts, whole-proposal budgets,
 * recovery metadata and choice revision stamps before adopting state and hydrated maps.
 * A fault discards every change, including the proposal-local RNG.
 */
export function adopt(
  world: World,
  decision: Admitted,
  command: Actor,
  mint: Mint,
  revision: number,
  steps: Steps = { n: 0 },
): Stepped {
  const { decision: out, limit } = propose(world, decision, command, mint, steps);
  if (out.kind !== 'accepted') return faulted(out, world, limit);
  const assigns = out.delta.ops.filter((o) => o.op === 'fact.assign') as Assign[];
  const bad = assigns.find((o) => !typedFact(world, o.fact, o.scope.kind, o.value));
  if (bad)
    return { decision: { kind: 'fault', code: 'precondition_failed', target: target(bad) }, world };
  // Every limit of the whole proposal in one call, so a tie names the first in 04 §5.4 order.
  const spent = over({
    ...counts(base(world), out.delta.ops),
    events: out.events.length,
    output_bytes: utf8(encode(out as never)).length,
  });
  if (spent) return faulted(BUDGET, world, spent);
  const applied = apply(world, out.delta.ops);
  if ('fault' in applied) return faulted(applied.fault, world, applied.limit);
  const resource = recoveryFault({ ...world, state: applied.state }, out.delta.ops);
  if (resource)
    return { decision: { kind: 'fault', code: 'precondition_failed', target: resource }, world };
  let choices = applied.state.choices;
  for (const o of out.delta.ops)
    if (o.op === 'choice.open') {
      const row = { ...choices![o.continuation_id]!, opened_revision: revision };
      choices = { ...choices, [o.continuation_id]: row };
    }
  const state = { ...applied.state, ...(choices && { choices }), rng: out.rng } as World['state'];
  return { decision: out, world: { ...applied.world, state } };
}

type Queued = { cause: DomainEvent; depth: number; mint: Mint; earns: QuestInstanceId[] };
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
  steps: Steps;
  at: World;
  applied: number;
  rng: World['state']['rng'];
  narration: Text[];
  limit?: Limit | undefined; // set only just before a budget fault returns
};
const BUDGET = { kind: 'fault', code: 'budget_exceeded' } as Admitted;
const faulted = (decision: DecisionResult, world: World, limit?: Limit): Stepped => ({
  decision,
  world,
  ...(limit && { limit }),
});

/** Root, due jobs and their FIFO deliveries compose atomically (docs/system/protocol.md).
 * Each sequence gets one writer group; event positions are global, allocators causal.
 * now() lazily applies the prefix and retains hydration/RNG for real later consumers.
 */
export function propose(
  world: World,
  root: Admitted,
  command: Actor,
  mint: Mint,
  steps: Steps,
): { decision: Admitted; limit?: Limit } {
  if (root.kind !== 'accepted') return { decision: root };
  const group = Math.max(0, ...root.delta.ops.map((o) => o.writer_group));
  const p: P = {
    world,
    command,
    ops: [],
    events: [],
    queue: [],
    group,
    deliveries: group,
    steps,
    at: world,
    applied: 0,
    rng: root.rng,
    narration: [...(root.narration ?? [])],
  };
  const base = { ...cause(p, world.state.clock, command.id), actor_id: command.payload.actor_id };
  const failed = join(p, root.delta.ops, root.events, base, 0, mint) ?? react(p) ?? jobs(p, root);
  if (failed) return { decision: failed, ...(p.limit && { limit: p.limit }) };
  return {
    decision: {
      ...root,
      delta: { ops: p.ops },
      events: p.events,
      rng: p.rng,
      ...(p.narration.length && { narration: p.narration }),
    },
  };
}

// The proposal so far, composed lazily (only a job, a delivery or an acquisition's quests read
// it), or its fault.
function now(p: P): World | Admitted {
  if (p.applied < p.ops.length) {
    const r = apply(p.at, p.ops.slice(p.applied));
    if ('fault' in r) {
      p.limit = r.limit;
      return r.fault as Admitted;
    }
    [p.at, p.applied] = [r.world, p.ops.length];
  }
  p.at = { ...p.at, state: { ...p.at.state, rng: p.rng } };
  return p.at;
}

// One explicit sequence joins: its ops, then its events with its fact_changed placed, numbered
// after the events before them and queued at `depth`, each with the quest instances it earns at
// its position (04 §5.2 step 5), or the fault composing the proposal so far: active before the
// sequence or by an earlier quest_activated, and not ended by an earlier quest_resolved. ponytail:
// an exit with no event (to objectives_complete) counts at the sequence's end; charged, skipped.
function join(
  p: P,
  own: readonly DeltaOp[],
  evs: readonly DomainEvent[],
  base: Base,
  depth: number,
  m: Mint,
): Admitted | undefined {
  const earns = p.world.cartridge.quests && evs.some((e) => e.payload.type === 'item_acquired');
  const before = earns ? now(p) : p.world;
  if (!('cartridge' in before)) return before;
  p.ops.push(...own);
  const after = earns ? now(p) : p.world;
  if (!('cartridge' in after)) return after;
  const quests = earns ? Object.entries(before.state.quests ?? {}) : [];
  const active = new Map(quests.map(([i, q]) => [i, q.state === 'active']));
  const assigns = own.filter((o) => o.op === 'fact.assign') as Assign[];
  for (const e of factChanged(base, m, assigns, evs)) {
    const placed = { ...e, position: p.events.length + 1, correlation_id: base.correlation_id };
    const x = placed.payload;
    if (x.type === 'quest_activated' || x.type === 'quest_resolved')
      active.set(x.instance_id, x.type === 'quest_activated');
    p.events.push(placed);
    const at = earns ? earned(after, x, (i) => active.get(i) === true) : [];
    p.queue.push({ cause: placed, depth, mint: m, earns: at });
  }
}

// What a sequence's fact_changed share when caused by `id` at `logical_time`.
const cause = (p: P, logical_time: number, id: string) => ({
  world_context_id: p.world.context,
  logical_time,
  causation_id: id as DomainEvent['causation_id'],
  correlation_id: p.command.id as string as Corr,
});

function creditDelivery(p: P, next: Queued): Admitted | undefined {
  if (next.cause.payload.type !== 'entity_died') return;
  const at = now(p);
  if (!('cartridge' in at)) return at;
  const credit = deathCredit(at, next.cause, p.ops, p.events);
  if (credit.length)
    return join(
      p,
      credit,
      [],
      cause(p, next.cause.logical_time, next.cause.id),
      next.depth,
      next.mint,
    );
}

// The queue's deliveries to quiescence, or the fault that ends them.
function react(p: P): Admitted | undefined {
  for (let next; (next = p.queue.shift());) {
    const credited = creditDelivery(p, next);
    if (credited) return credited;
    for (const instance_id of next.earns) {
      if ((p.limit = over({ deliveries: ++p.deliveries }))) return BUDGET;
      const at = now(p);
      if (!('cartridge' in at)) return at;
      if (at.state.quests![instance_id]!.state !== 'active') continue;
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
      p.limit = over({ deliveries: ++p.deliveries, reaction_depth: depth, query_steps: p.steps.n });
      if (p.limit) return BUDGET;
      if (!own) continue;
      p.group++;
      const base = cause(p, next.cause.logical_time, next.cause.id);
      const failed = join(p, own, [], base, depth, next.mint);
      if (failed) return failed;
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
    const current = at.state.jobs?.[job_id];
    if (
      !current ||
      current.status !== 'pending' ||
      (current.encounter_id && !currentRound(at, job_id as JobId, current))
    )
      continue;
    const run = {
      id: jobCommandId(job_id, due_time) as CommandId,
      world_context_id: p.world.context,
      payload: { type: 'run_job', job_id: job_id as JobId },
    } as const;
    const m = allocator(at, run);
    const ran = admit('schedule', schedule.decide(at, run, m));
    if (ran.kind !== 'accepted') return ran;
    p.rng = ran.rng;
    p.narration.push(...(ran.narration ?? []));
    const own = ran.delta.ops.map((o) => ({ ...o, writer_group: p.group + 1 }));
    p.group++;
    const failed = join(p, own, ran.events, cause(p, due_time, run.id), 0, m) ?? react(p);
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
