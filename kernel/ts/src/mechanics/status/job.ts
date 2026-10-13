import type {
  Command,
  DefinitionRef,
  DeltaOp,
  DomainEvent,
  EntityId,
  JobId,
  StatusDefinition,
  StatusRow,
  TextKey,
} from '../../contracts.gen.ts';
import { add } from '../../foundation/int.ts';
import { accepted, type JobRow, type Mint, type World } from '../../runtime/decision.ts';
import { currentRound } from '../combat/round.ts';
import { replenishMovers } from '../containment/job.ts';
import { adjust, level, resourceSpec } from '../resource.ts';
import { fatalTick } from './fatal.ts';
import { expire, specOf } from './shared.ts';

// A timed row: only it owns a job (a permanent one, row W8, has none).
type Active = Required<Extract<StatusRow, { active: true }>>;

/**
 * A due status tick or expiry on its holder (the player's body, an NPC or an item; rows 1, G3);
 * an obsolete job completes harmlessly. Narration is the player's only. A successor the same
 * advance also crosses runs as a sub-step at `now` (`next`, runtime/proposal_hours.ts, loka-6ztc):
 * its job is already complete and its row's tick stale (a refresh writes the end there,
 * status/shared.ts refreshed), so the drain carries its true tick (`carried`); only the last
 * sub-step writes the row's successor.
 */
// size: allow 44, one due job saturates the tick, expires, or runs the fatal death sequence
export function runStatus(
  world: World,
  command: Pick<Command, 'id'>,
  job_id: JobId,
  job: JobRow,
  mint: Mint,
  now = job.due_time,
  carried?: number,
) {
  const first = job.status === 'pending';
  const ops: DeltaOp[] = first ? [{ op: 'job.complete', writer_group: 0, job_id }] : [];
  const status = job.job;
  const held = statusHolder(world, job_id);
  if (!held) return accepted<never>(world, 'job_ran', ops, []);
  const { body, row } = held;
  const spec = specOf(world, status);
  if (!spec) return { kind: 'fault', code: 'precondition_failed' } as const;
  const player = body === world.body;
  const tick = carried ?? row.next_tick_at;
  const visit = { ...world, state: { ...world.state, clock: now } };
  const expired = now >= row.ends_at;
  const due = !expired && spec.per_tick !== undefined && now >= tick;
  const { by, fatal } = due ? amount(visit, body, spec) : { by: 0, fatal: false };
  if (by) ops.push({ ...adjust(visit, body, spec.resource, by, {}).op, at: now });
  if (expired) ops.push(...expire(visit, body, status, row, 0));
  const say = (key: TextKey) => (player ? [{ key }] : []);
  const events = due ? [happened(visit, command, mint, 'status_ticked', body, status)] : [];
  if (fatal)
    return fatalTick(visit, command, ops, events, held, status, mint, say(spec.narration.tick));
  if (expired) {
    const ended = [happened(visit, command, mint, 'status_expired', body, status)];
    return accepted(world, 'job_ran', ops, ended, say(spec.narration.expired));
  }
  // A due tick on an unreadable pool is skipped, never re-due at the same clock.
  const next_tick_at = due ? add(tick, spec.tick_every) : untick(spec, row, tick);
  const next = Math.min(next_tick_at, row.ends_at);
  const crossed = next <= world.state.clock;
  if (!crossed) ops.push(...successor(body, status, row, next_tick_at, mint() as JobId));
  const ran = accepted(world, 'job_ran', ops, events, by ? say(spec.narration.tick) : []);
  return crossed ? { ...ran, next, tick: next_tick_at } : ran;
}

/**
 * A due tick's change, saturated at the pool bounds (the op itself stays exact), and whether it
 * takes hp to 0. An item or room has no pools: its tick changes nothing but still emits status_ticked.
 */
function amount(visit: World, body: EntityId, spec: StatusDefinition) {
  const current = level(visit, body, spec.resource);
  const pool = resourceSpec(visit, body, spec.resource);
  if (visit.entities[body]?.kind === 'item' || visit.rooms[body] || current === undefined || !pool)
    return { by: 0, fatal: false };
  const by = Math.max(pool.minimum - current, Math.min(pool.maximum - current, spec.per_tick!));
  return { by, fatal: by < 0 && spec.resource.key === 'hp' && current + by === 0 };
}

/**
 * The active row this job owns and its holder. The job names no holder, so this reads the row key,
 * the canonical status target text (save.md, Status recovery).
 * ponytail: scans every status row per due job; bind the holder on the job if rows grow large.
 */
export function statusHolder(world: World, job_id: JobId) {
  for (const [at, row] of Object.entries(world.state.statuses ?? {}))
    if (row.active && row.job_id === job_id)
      return { body: (JSON.parse(at) as { body_id: EntityId }).body_id, row: row as Active };
  return undefined;
}

// A job's status event, instance-scoped like a scheduled NPC's entry (schedule/behavior.ts entered).
const happened = (
  world: World,
  run: Pick<Command, 'id'>,
  mint: Mint,
  type: 'status_ticked' | 'status_expired',
  body_id: EntityId,
  status: DefinitionRef,
) => ({
  id: mint() as DomainEvent['id'],
  world_context_id: world.context,
  scope: { kind: 'instance', world_context_id: world.context } as const,
  logical_time: world.state.clock,
  position: 1,
  causation_id: run.id as string as DomainEvent['causation_id'],
  correlation_id: run.id as string as DomainEvent['correlation_id'],
  payload: { type, body_id, status },
});

// A status that never ticks (row 2c) follows a refreshed end.
const untick = (spec: StatusDefinition, row: Active, tick: number) =>
  spec.per_tick === undefined ? row.ends_at : tick;

// The row's next job, due at the earlier of its next tick and its end.
const successor = (
  body: EntityId,
  status: DefinitionRef,
  row: Active,
  next_tick_at: number,
  job_id: JobId,
): DeltaOp[] => [
  {
    op: 'status.transition',
    writer_group: 0,
    body_id: body,
    status,
    expected: row,
    value: { ...row, next_tick_at, job_id },
  },
  {
    op: 'job.schedule',
    writer_group: 0,
    job_id,
    job: status,
    due_time: Math.min(next_tick_at, row.ends_at),
  },
];

// Status jobs on one holder in one advance share a writer group, so two ticks on one pool compose
// in sequence; a reaction's status.apply on that holder, before or after, shares it (reaction.ts
// statusStep, row G3); so does a combat round on its body or opponent, whose hp a status's tick or
// hp settle (row 2c) also writes; every roster member counts, as the player's or an ally's blow
// falls on another member when the primary is gone (row 6b); a bleed tick on its body joins too, so
// a round and its equal-due bleed (C5 pair) share one; a replenish run joins the groups of the items
// it moves (replenishMovers, row 41). A round joins all of those groups: the lowest
// is kept and the others are returned for the caller to merge into it (loka-x2gv).
export function statusGroup(
  at: World,
  id: JobId,
  job: JobRow,
  holders: Map<string, number>,
  next: number,
) {
  const round = currentRound(at, id, job);
  const held = round
    ? [round.body_id, ...(round.active_ids ?? [round.npc_id])]
    : job.job.kind === 'replenish'
      ? replenishMovers(at, job) // row 41: a decay move and a restock of one item share a group
      : [job.job.kind === 'status' ? statusHolder(at, id)?.body : job.bleed_body_id];
  const bodies = held.filter((b) => b !== undefined);
  if (!bodies.length) return undefined;
  const found = new Set(bodies.map((b) => holders.get(b)));
  found.delete(undefined);
  const group = found.size ? Math.min(...(found as Set<number>)) : next;
  found.delete(group);
  for (const b of bodies) holders.set(b, group);
  return { group, merged: found as Set<number> };
}

// Relabel a proposal's writes so far, and each group map, from the merged groups to `to`, so the
// rows they wrote compose in sequence with the joining job's (loka-x2gv).
export function merge(ops: DeltaOp[], from: Set<number>, to: number, maps: Map<string, number>[]) {
  if (!from.size) return;
  ops.forEach((o, i) => from.has(o.writer_group) && (ops[i] = { ...o, writer_group: to }));
  for (const m of maps) for (const [k, g] of m) if (from.has(g)) m.set(k, to);
}
