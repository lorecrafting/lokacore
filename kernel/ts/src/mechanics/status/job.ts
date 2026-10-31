import type {
  Command,
  DefinitionRef,
  DeltaOp,
  DomainEvent,
  EntityId,
  JobId,
  StatusDefinition,
  StatusRow,
  Text,
  TextKey,
} from '../../contracts.gen.ts';
import { add } from '../../foundation/int.ts';
import {
  accepted,
  actorOf,
  admitted,
  type JobRow,
  type Mint,
  refString,
  type World,
} from '../../runtime/decision.ts';
import { currentRound } from '../combat/round.ts';
import { CLOCK_JOB } from '../schedule/daily.ts';
import { replenishMovers } from '../containment/job.ts';
import { adjust, level, resourceSpec } from '../resource.ts';
import { visible } from '../light/shared.ts';
import { fatalTick } from './fatal.ts';
import { expire, specOf } from './shared.ts';

type Queue = readonly (readonly [string, { due_time: number }])[];

// A row that owns a job: timed, or permanent and ticking (no ends_at, row W8, loka-rn3b).
type Active = Extract<StatusRow, { active: true }> & { next_tick_at: number; job_id: JobId };

/**
 * A due status tick or expiry on its holder (the player's body, an NPC or an item; rows 1, G3);
 * an obsolete job completes harmlessly. Narration is the player's, or a seen item's or the player's room's expiry (`watched`). A successor the same
 * advance also crosses runs as a sub-step at `now` (`next`, runtime/proposal_hours.ts, loka-6ztc):
 * its job is already complete and its row's tick stale (a refresh writes the end there,
 * status/shared.ts refreshed), so the drain carries its true tick (`carried`); only the last
 * sub-step writes the row's successor.
 */
// size: allow 47, one due job saturates or folds the tick, expires, or runs the fatal death sequence
export function runStatus(
  world: World,
  command: Pick<Command, 'id'>,
  job_id: JobId,
  job: JobRow,
  mint: Mint,
  now = job.due_time,
  carried?: number,
  queue?: Queue,
) {
  const first = job.status === 'pending';
  const ops: DeltaOp[] = first ? [{ op: 'job.complete', writer_group: 0, job_id }] : [];
  const status = job.job;
  const held = statusHolder(world, job_id);
  if (!held) return accepted<never>(world, 'job_ran', ops, []);
  const { body, row } = held;
  const spec = specOf(world, status);
  if (!spec) return { kind: 'fault', code: 'precondition_failed' } as const;
  const player = actorOf(world, body) !== undefined;
  const tick = carried ?? row.next_tick_at;
  const visit = { ...world, state: { ...world.state, clock: now } };
  const expired = now >= (row.ends_at ?? Infinity);
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
    // ponytail: an item or room reuses the player's own expired line (third person for burning, the
    // only observed item status today); add a holder-specific key when a second-person one reaches them.
    // Only a timed row expires, and a timed status declares expired (compiler, loka-rn3b).
    const lines = player || watched(visit, body, spec) ? [{ key: spec.narration.expired! }] : [];
    return accepted(world, 'job_ran', ops, ended, lines);
  }
  // A due tick on an unreadable pool is skipped, never re-due at the same clock.
  const ticks = due ? foldedTicks(visit, world.state.clock, job_id, job, tick, spec, queue) : 0;
  const next_tick_at = due ? add(tick, spec.tick_every * ticks) : untick(spec, row, tick);
  const next = Math.min(next_tick_at, row.ends_at ?? Infinity);
  const crossed = next <= world.state.clock;
  if (!crossed) ops.push(...successor(body, status, row, next_tick_at, mint() as JobId));
  const ran = accepted(world, 'job_ran', ops, events, by ? say(spec.narration.tick) : []);
  return crossed ? { ...ran, next, tick: next_tick_at } : ran;
}

/**
 * loka-y6yg.48: an item whose status declares an observed line, seen in an admitted player's room,
 * tells its expiry; loka-x6t.37: so does a room an admitted player stands in, unlit or not.
 */
const watched = (w: World, holder: EntityId, spec: StatusDefinition) =>
  !!spec.narration.observed &&
  admitted(w).some(([actor, body]) =>
    w.rooms[holder]
      ? w.state.containers[body] === holder
      : w.entities[holder]?.kind === 'item' &&
        w.state.containers[holder] === w.state.containers[body] &&
        visible(w, actor, holder),
  );

/** loka-y6yg.48: items going out in one advance tell each expired line once per receipt (a woodpile is one line). */
export const unsaid = (
  w: World,
  job_id: JobId,
  receipt: readonly Text[],
  lines: readonly Text[] = [],
) =>
  lines.length && w.entities[statusHolder(w, job_id)?.body ?? '']?.kind === 'item'
    ? lines.filter((l) => !receipt.some((t) => t.key === l.key))
    : lines;

/** Whether this job's tick is a no-op that catch-up may fold (mechanics.md, W8 Catch-up). */
export function folds(world: World, job_id: JobId, job: JobRow) {
  if (job.job.kind !== 'status') return false;
  const held = statusHolder(world, job_id);
  const spec = specOf(world, job.job);
  if (!held || held.row.ends_at !== undefined || spec?.per_tick === undefined) return false;
  const pool = resourceSpec(world, held.body, spec.resource);
  const body = world.entities[held.body]?.kind !== 'item' && !world.rooms[held.body];
  if (!body || !pool || level(world, held.body, spec.resource) === undefined) return false;
  if (amount(world, held.body, spec).by !== 0 || pool.gain !== 0 || pool.regen) return false;
  const ref = refString(job.job);
  return !Object.values(world.cartridge.reactions ?? {}).some(
    ({ on }) =>
      on.event === 'status_ticked' && (on.status === undefined || refString(on.status) === ref),
  );
}

/**
 * The ticks from this one to the next: 1, or for a fold the first after the target and at or after
 * another job's next queued run. Only the drain's queue shows a job in flight: its row is complete.
 */
function foldedTicks(
  visit: World,
  target: number,
  job_id: JobId,
  job: JobRow,
  tick: number,
  spec: StatusDefinition,
  queue?: Queue,
) {
  if (!queue || !folds(visit, job_id, job)) return 1;
  let horizon = target;
  for (const [id, { due_time }] of queue) {
    const other = visit.state.jobs?.[id];
    if (id === job_id || due_time <= visit.state.clock || due_time > horizon || !other) continue;
    if (other.job.kind !== CLOCK_JOB && !folds(visit, id as JobId, other)) horizon = due_time - 1;
  }
  return Math.floor((horizon - tick) / spec.tick_every) + 1;
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

// A job's status event, instance-scoped like a scheduled NPC's entry (schedule/daily.ts entered).
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

// A status that never ticks (row 2c, always timed) follows a refreshed end.
const untick = (spec: StatusDefinition, row: Active, tick: number) =>
  spec.per_tick === undefined ? row.ends_at! : tick;

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
    due_time: Math.min(next_tick_at, row.ends_at ?? Infinity),
  },
];

// Status jobs on one holder in one advance share a writer group, so two ticks on one pool compose
// in sequence; a reaction's status.apply on that holder, before or after, shares it (reaction.ts
// statusStep, row G3); so does a combat round on its body or opponent, whose hp a status's tick or
// hp settle (row 2c) also writes; every roster member counts, as the player's or an ally's blow
// falls on another member when the primary is gone (row 6b); a bleed tick on its body joins too, so
// a round and its equal-due bleed (C5 pair) share one; a replenish run joins the groups of the items
// it moves (replenishMovers, row 41); a delayed reaction's run joins the groups of every row it
// writes through the same holders map an ordinary reaction uses (reaction.ts holders, row FD1). A
// round joins all of those groups: the lowest is kept and the others are returned for the caller to
// merge into it (loka-x2gv).
export function statusGroup(
  at: World,
  id: JobId,
  job: JobRow,
  holders: Map<string, number>,
  next: number,
  ops: readonly DeltaOp[] = [],
) {
  if (job.job.kind === 'reaction') return joined(ops); // its run took the holders' groups
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

// A delayed reaction's run (row FD1) wrote each row in the group its holder already had, else in
// the run's fresh one: the lowest is the job's, the others merge into it.
function joined(ops: readonly DeltaOp[]) {
  const found = new Set(ops.map((o) => o.writer_group));
  const group = Math.min(...found);
  found.delete(group);
  return { group, merged: found };
}

// Relabel a proposal's writes so far, and each group map, from the merged groups to `to`, so the
// rows they wrote compose in sequence with the joining job's (loka-x2gv).
export function merge(ops: DeltaOp[], from: Set<number>, to: number, maps: Map<string, number>[]) {
  if (!from.size) return;
  ops.forEach((o, i) => from.has(o.writer_group) && (ops[i] = { ...o, writer_group: to }));
  for (const m of maps) for (const [k, g] of m) if (from.has(g)) m.set(k, to);
}
