// World state from a loaded loka-cartridge-v2 artifact, the command step and the GameView
// (03 §1, §3, §23; 04 §1-§5.1, §14; 21 §5). Rules are pure and live in rules/<capability>.ts
// (lint/rules/ts-rule-module-*.yml); this module routes each command to the rule of the
// capability that owns it (capability_registry.json), composes the delta and commits it.
import { encode } from './canonical.ts';
import { KernelError } from './error.ts';
import type { Installed } from './cartridge.ts';
import { compose, key, over, target, type Fault } from './compose.ts';
import {
  CAPABILITY_OWNERS,
  LIMITS,
  type CharacterId,
  type Command,
  type CommandId,
  type DecisionResult,
  type DeltaOp,
  type DomainEvent,
  type EntityId,
  type ErrorCode,
  type JobId,
  type Owned,
  type WorldContextId,
} from './contracts.gen.ts';
import {
  allocator,
  COMPOSES,
  event,
  refString,
  rejected,
  row,
  type Cartridge,
  type Detail,
  type Entity,
  type Mint,
  type Rule,
  type State,
  type World,
} from './decision.ts';
import { factChanged, invariants as factInvariants, typedFact, type Base } from './fact.ts';
import { id, jobCommandId } from './id_source.ts';
import type { RngState } from './rng.ts';
import { utf8 } from './sha256.ts';
import { refusal } from './actions.ts';
import * as action_recipe from './rules/action_recipe.ts';
import * as barrier from './rules/barrier.ts';
import * as containment from './rules/containment.ts';
import * as description_variant from './rules/description_variant.ts';
import * as movement from './rules/movement.ts';
import * as quest from './rules/quest.ts';
import * as schedule from './rules/schedule.ts';
import { deliver } from './quest.ts';
import { sequence, triggered } from './reaction.ts';
import { newWorld, NIL } from './fresh.ts';
import { cmp } from './validate.ts';

// Each capability's rule; the key binds a module to the capability whose commands reach it.
const RULES: { readonly [C in keyof Owned]?: Rule<C> } = {
  movement: movement.decide,
  description_variant: description_variant.decide,
  containment: containment.decide,
  action_recipe: action_recipe.decide,
  schedule: schedule.decide,
  barrier: barrier.decide,
  quest: quest.decide,
};

// Capabilities that own no command, so no rule: what the rules and the GameView call implements
// them (fact.ts, policy.ts, resource.ts, reaction.ts; details in target.ts and look; a recipe's
// check in rules/action_recipe.ts). Each has feature map cells.
const RULELESS = [
  'fact',
  'policy',
  'inspectable_detail',
  'check',
  'resource',
  'behavior',
  'calendar',
  'reaction',
];

/** What this kernel implements, for the loader (05 §3, §6): each capability above, at 1. */
export const INSTALLED: Installed = {
  kernel_api: '1.0',
  capabilities: Object.fromEntries([...Object.keys(RULES), ...RULELESS].map((k) => [k, [1]])),
  content_schema: 1,
  rule_ir: 1,
  client_features: [],
};

/**
 * Decides and, when accepted, composes and commits one command (04 §5): routes it to the rule
 * of the capability that owns its type (capability_registry.json), rejecting it with
 * unsupported_capability when that capability is not in the lock or has no rule here.
 */
export function step(world: World, command: Command): Stepped {
  const owner = ownerOf(CAPABILITY_OWNERS.command, command.payload.type) ?? '';
  const rule = RULES[owner as keyof Owned] as unknown as AnyRule | undefined;
  if (!rule || !Object.hasOwn(world.cartridge.lock.capabilities, owner))
    return { decision: rejected('unsupported_capability'), world };
  return decideWith(world, command, owner, rule);
}

// The capability owning a command or event type; own keys only, so `constructor` names none.
const ownerOf = (owners: Readonly<Record<string, string>>, type: string) =>
  Object.hasOwn(owners, type) ? owners[type]!.split('@')[0] : undefined;

type Stepped = { decision: DecisionResult; world: World };
type Actor = Parameters<typeof event>[1];
type AnyRule = (w: World, c: Command, mint: Mint) => DecisionResult;

/**
 * The admission boundary around one rule call. Before the rule: the nil CommandId is reserved
 * for world creation (permission_denied; R6 must keep this refusal before any receipt); a
 * command for another world (not_found) or another actor (not_found) is rejected, and so is one
 * the actor's ActionSet does not offer or offers unavailable (actions.ts refusal; 04 §19, ACT-09).
 * A KernelError thrown while deciding is an evaluator_error fault with the world unchanged. After it: admit() checks the
 * result, quest delivery adds the objective transitions its events earn (quest.ts deliver; no
 * event, so it stays admitted), then the delta composes or faults before the changes are adopted.
 */
function decideWith(world: World, command: Command, owner: string, rule: AnyRule): Stepped {
  const reject = (code: ErrorCode) => ({ decision: rejected(code), world });
  if (command.id === NIL) return reject('permission_denied');
  if (command.world_context_id !== world.context) return reject('not_found');
  if (!('actor_id' in command.payload) || command.payload.actor_id !== world.character)
    return reject('not_found');
  const refused = refusal(world, command.payload);
  if (refused) return reject(refused);
  const mint = allocator(world, command);
  try {
    const decided = deliver(world, admit(owner, rule(world, command, mint)));
    return adopt(world, decided, command as Actor, mint);
  } catch (e) {
    // 04 §5.2 step 7: a numeric-profile error is a typed fault; any other throw is a bug.
    if (!(e instanceof KernelError)) throw e;
    return { decision: { kind: 'fault', code: 'evaluator_error' }, world };
  }
}

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
function apply(world: World, ops: readonly DeltaOp[]): { state: State } | { fault: Fault } {
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

/**
 * The whole proposal of an admitted root decision (04 §5.2 steps 4-6, §5.4), each explicit
 * sequence joining in turn: its ops, then its events, with the fact_changed of each assign that
 * changes its fact (fact.ts factChanged) at its causal position, numbered after the events before
 * them and correlated to the command; each event then queued FIFO for the reactions it triggers
 * (reaction.ts). The root sequence (writer group 0, then quest.ts deliver's groups) and its
 * reactions to quiescence; then, when its delta has a time.advance (a wait, or a recipe's
 * duration), each due job and its reactions to quiescence before the next. One counter numbers
 * every later writer group: each job and each reaction delivery takes the next.
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
 * A reaction delivery (04 §5.2 steps 5-6): each rule an event triggers, in rule-key order, whose
 * `when` holds on the proposal so far at the event's logical time, is a delivery of its own
 * writer group at one more than its cause's reaction depth (a root's or job's events are at 0),
 * its fact_changed caused by that event at its logical time, its ids from the IdSource of the
 * root or job that began the chain. A delivery past the deliveries, events or reaction_depth
 * limit (compose.ts over) faults budget_exceeded: a cycle ends there, never truncated.
 * ponytail: quest.ts deliver sees only the root's events: a quest objective meets only an
 * item_acquired, which no job or reaction emits; route their events through it when one can.
 * ponytail: the 04 §5.4 re-read of an entry before it runs is run_job's own status check
 * (rules/schedule.ts), and a stale entry it refuses rejects the whole advance instead of being
 * skipped as ineligible. Nothing in schedule@1 or reaction@1 cancels, reschedules or completes
 * another job, so no entry goes stale yet; the first operation that can turns that refusal into a
 * skip and adds the generation to the comparison.
 */
function propose(world: World, root: Admitted, command: Actor, mint: Mint): Admitted {
  if (root.kind !== 'accepted') return root;
  const ops: DeltaOp[] = [];
  const events: DomainEvent[] = [];
  const queue: { cause: DomainEvent; depth: number; mint: Mint }[] = [];
  let group = Math.max(0, ...root.delta.ops.map((o) => o.writer_group));
  let deliveries = group;
  // The proposal so far, composed lazily: only a job or a delivery reads it.
  let proposal = world;
  let applied = 0;
  const now = (): World | Admitted => {
    if (applied < ops.length) {
      const r = apply(proposal, ops.slice(applied));
      if ('fault' in r) return r.fault as Admitted;
      [proposal, applied] = [{ ...world, state: r.state }, ops.length];
    }
    return proposal;
  };
  const join = (
    own: readonly DeltaOp[],
    evs: readonly DomainEvent[],
    base: Base,
    depth: number,
    m: Mint,
  ) => {
    ops.push(...own);
    const assigns = own.filter((o) => o.op === 'fact.assign') as Assign[];
    for (const e of factChanged(base, m, assigns, evs)) {
      const placed = { ...e, position: events.length + 1, correlation_id: base.correlation_id };
      events.push(placed);
      queue.push({ cause: placed, depth, mint: m });
    }
  };
  const corr = command.id as string as Corr;
  const cause = (logical_time: number, id: string) => ({
    world_context_id: world.context,
    logical_time,
    causation_id: id as DomainEvent['causation_id'],
    correlation_id: corr,
  });
  // The queue's deliveries to quiescence, or the fault that ends them.
  const react = (): Admitted | undefined => {
    for (let next; (next = queue.shift());) {
      for (const rule of triggered(world, next.cause)) {
        const at = now();
        if (!('cartridge' in at)) return at;
        const own = sequence(at, command.payload.actor_id, rule, next.cause, group + 1);
        if (!own) continue;
        group++;
        join(own, [], cause(next.cause.logical_time, next.cause.id), next.depth + 1, next.mint);
        if (
          over({ deliveries: ++deliveries, events: events.length, reaction_depth: next.depth + 1 })
        )
          return { kind: 'fault', code: 'budget_exceeded' } as Admitted;
      }
    }
  };
  const actor = { actor_id: command.payload.actor_id };
  join(root.delta.ops, root.events, { ...cause(world.state.clock, command.id), ...actor }, 0, mint);
  const ended = react();
  if (ended) return ended;
  const advance = root.delta.ops.find((o) => o.op === 'time.advance');
  const due = Object.entries(advance ? (world.state.jobs ?? {}) : {})
    .filter(([, j]) => j.status === 'pending' && j.due_time <= advance!.to)
    .sort(([a, x], [b, y]) => x.due_time - y.due_time || cmp(a, b));
  for (const [job_id, { due_time }] of due) {
    const at = now();
    if (!('cartridge' in at)) return at;
    const run = {
      id: jobCommandId(job_id, due_time) as CommandId,
      world_context_id: world.context,
      payload: { type: 'run_job', job_id: job_id as JobId },
    } as const;
    const m = allocator(at, run);
    const ran = admit('schedule', schedule.decide(at, run, m));
    if (ran.kind !== 'accepted') return ran;
    group++;
    const own = ran.delta.ops.map((o) => ({ ...o, writer_group: group }));
    join(own, ran.events, cause(due_time, run.id), 0, m);
    const failed = react();
    if (failed) return failed;
  }
  return { ...root, delta: { ops }, events };
}
type Corr = DomainEvent['correlation_id'];

type Assign = Extract<DeltaOp, { op: 'fact.assign' }>;

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

const INVARIANTS = { ...movement.invariants, ...factInvariants, ...containment.invariants };

/** True when the registered invariant holds for the world; throws for an unknown id. */
export function holds(id: string, world: World): boolean {
  if (!Object.hasOwn(INVARIANTS, id)) throw new Error(`unknown invariant ${id}`);
  return INVARIANTS[id](world);
}

export { gameView } from './view.ts';
export { newWorld };
export { row } from './decision.ts';
