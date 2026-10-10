import { enteredActors, knowledgeLast, record } from '../mechanics/knowledge/shared.ts';
import { vary } from '../mechanics/variety.ts';
// size: allow 340, typed quest reactions and same-plan deadline pairing share FIFO admission
// Proposal admission, FIFO composition and adoption (04 §5.1-§5.4); runtime/world.ts routes commands here.
import { populationDeadlinePairs } from './proposal_deadlines.ts';
import { apply } from './apply.ts';
import { over, type Limit } from '../foundation/compose.ts';
import {
  type CommandId,
  type DeltaOp,
  type DomainEvent,
  type JobId,
  type QuestInstanceId,
  type Text,
} from '../contracts.gen.ts';
import { allocator, event, type JobRow, type Mint, type Steps, type World } from './decision.ts';
import { factChanged, type Base } from '../mechanics/fact.ts';
import { jobCommandId } from '../foundation/id_source.ts';
import { earned } from '../mechanics/quest/lifecycle.ts';
import { sequence, triggered } from '../mechanics/reaction.ts';
import { levelUp, oneWrite } from '../mechanics/levelling/shared.ts';
import * as schedule from '../mechanics/schedule/rule.ts';
import { cmp } from '../foundation/validate.ts';
import { currentRound } from '../mechanics/combat/round.ts';
import { handoffGroup, sightHandoff } from './proposal_sight.ts';
import { bleedRoundPair } from './proposal_bleed.ts';
import { statusHolder } from '../mechanics/status/job.ts';
import { anyPending as pending, parted } from '../mechanics/dialogue/selection.ts';
import { admit, type Admitted } from './proposal_admit.ts';
export { admit, ownerOf, type Admitted } from './proposal_admit.ts';
import { deathCredit } from '../mechanics/combat/credit.ts';
import { dropped as crowDrop, taken as crowTake } from '../mechanics/crow/behavior.ts';

// limit: a budget_exceeded fault's exhausted limit, a side value never in the result (04 §5.4).
export { adopt } from './proposal_adopt.ts';
export type { Stepped } from './proposal_adopt.ts';
export type Actor = Parameters<typeof event>[1];
type Assign = Extract<DeltaOp, { op: 'fact.assign' }>;
type Corr = DomainEvent['correlation_id'];

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
  holders: Map<string, number>; // each status holder's writer group in this advance (row G3)
  limit?: Limit | undefined; // set only just before a budget fault returns
};
export const BUDGET = { kind: 'fault', code: 'budget_exceeded' } as Admitted;
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
    holders: new Map(),
  };
  const base = { ...cause(p, world.state.clock, command.id), actor_id: command.payload.actor_id };
  const failed =
    join(p, root.delta.ops, root.events, base, 0, mint) ?? react(p) ?? jobs(p, root) ?? farewell(p);
  if (failed) return { decision: failed, ...(p.limit && { limit: p.limit }) };
  const ops = oneWrite(p.ops);
  p.narration.push(...levelUp(world, ops));
  return {
    decision: {
      ...root,
      delta: { ops: knowledgeLast(ops) },
      events: p.events,
      rng: p.rng,
      ...(p.narration.length && { narration: vary(world.cartridge, command.id, p.narration) }),
    },
  };
}

// dialogue@1: each conversation whose actor and speaker no longer share a room once the proposal
// is composed ends as Leave would (choice.close, no event), in the writer group that opened it here,
// else a new one. Composed only while a conversation may be open (no per-action apply otherwise).
function farewell(p: P): Admitted | undefined {
  const opened = new Map<string, number>();
  for (const o of p.ops) if (o.op === 'choice.open') opened.set(o.continuation_id, o.writer_group);
  if (!opened.size && !pending(p.world)) return;
  const at = now(p);
  if (!('cartridge' in at)) return at;
  const ids = parted(at);
  const group = ids.some((id) => !opened.has(id)) ? ++p.group : p.group;
  for (const continuation_id of ids)
    p.ops.push({
      op: 'choice.close',
      writer_group: opened.get(continuation_id) ?? group,
      continuation_id,
    });
}

// The proposal so far, composed lazily (only a job, a delivery or an acquisition's quests read
// it), or its fault.
function now(p: P): World | Admitted {
  if (p.applied < p.ops.length) {
    const r = apply(p.at, p.ops.slice(p.applied), false);
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
  const actors = enteredActors(p.world, own);
  if (actors.size) {
    const at = now(p);
    if (!('cartridge' in at)) return at;
    for (const actor of actors) p.ops.push(...record(at, actor, true, p.steps));
  }
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
// size: allow 45, one existing FIFO loop admits typed quest reaction deliveries
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
    const crow = crowDelivery(p, next);
    if (crow) return crow;
    for (const rule of triggered(p.world, next.cause)) {
      const at = now(p);
      if (!('cartridge' in at)) return at;
      const own = sequence(
        at,
        p.command.payload.actor_id,
        rule,
        next.cause,
        p.group + 1,
        p.steps,
        next.mint,
        p.holders,
      );
      const depth = next.depth + 1;
      p.limit = over({ deliveries: ++p.deliveries, reaction_depth: depth, query_steps: p.steps.n });
      if (p.limit) return BUDGET;
      if (!own) continue;
      const delivered = admit('reaction', own);
      if (delivered.kind !== 'accepted') return delivered;
      p.group++;
      const base = cause(p, next.cause.logical_time, next.cause.id);
      const failed = join(p, delivered.delta.ops, delivered.events, base, depth, next.mint);
      if (failed) return failed;
    }
  }
}

// Each due job of the root's explicit advance, then its reactions, or the result that ends them.
// size: allow 48, due job delivery joins population, bleed and status group pairing before causal reactions
function jobs(p: P, root: Admitted & { kind: 'accepted' }): Admitted | undefined {
  const advance = root.delta.ops.find((o) => o.op === 'time.advance');
  const due = Object.entries(advance ? (p.world.state.jobs ?? {}) : {})
    .filter(([, j]) => j.status === 'pending' && j.due_time <= advance!.to)
    .sort(([a, x], [b, y]) => x.due_time - y.due_time || cmp(a, b));
  const populationPairs = populationDeadlinePairs(p.world, advance?.to ?? -1);
  const groups = new Map<string, number>();
  const bleedPairs = new Map<string, number>();
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
    const partner = populationPairs.get(job_id);
    const group =
      (partner ? groups.get(partner) : undefined) ??
      bleedPairs.get(job_id) ??
      statusGroup(at, job_id as JobId, current, p.holders, p.group + 1) ??
      p.group + 1;
    groups.set(job_id, group);
    const bleedPair = bleedRoundPair(at, job_id as JobId, current);
    if (bleedPair) bleedPairs.set(bleedPair, group);
    const handoff = sightHandoff(p.world, p.ops, at, job_id as JobId, due_time, ran.delta.ops);
    const own = ran.delta.ops.map((o) => ({
      ...o,
      writer_group: handoffGroup(o, handoff, group),
    }));
    p.group++;
    const failed = join(p, own, ran.events, cause(p, due_time, run.id), 0, m) ?? react(p);
    if (failed) return failed;
  }
}

// Status jobs on one holder in one advance share a writer group, so two ticks on one pool compose
// in sequence; a reaction's status.apply on that holder joins it too (reaction.ts statusStep, row G3).
function statusGroup(
  at: World,
  id: JobId,
  job: JobRow,
  holders: Map<string, number>,
  next: number,
) {
  const held = job.job.kind === 'status' ? statusHolder(at, id)?.body : undefined;
  if (held && !holders.has(held)) holders.set(held, next);
  return held ? holders.get(held) : undefined;
}

function crowDelivery(p: P, next: Queued): Admitted | undefined {
  if (next.cause.payload.type === 'item_dropped' || next.cause.payload.type === 'item_acquired') {
    const at = now(p);
    if (!('cartridge' in at)) return at;
    const ops =
      next.cause.payload.type === 'item_dropped'
        ? crowDrop(at, next.cause, next.mint)
        : crowTake(at, next.cause);
    if (ops.length) {
      if ((p.limit = over({ deliveries: ++p.deliveries }))) return BUDGET;
      p.group++;
      const failed = join(
        p,
        ops.map((op) => ({ ...op, writer_group: p.group })),
        [],
        cause(p, next.cause.logical_time, next.cause.id),
        next.depth + 1,
        next.mint,
      );
      if (failed) return failed;
    }
  }
}
