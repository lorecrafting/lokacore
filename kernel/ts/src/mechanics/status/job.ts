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
import { prefix } from '../combat/round_attack.ts';
import { closeEncounter, engaged } from '../combat/shared.ts';
import { deathSequence } from '../death/sequence.ts';
import { adjust, level, resourceSpec } from '../resource.ts';
import { endStatus, expire, specOf } from './shared.ts';

type Active = StatusRow & { active: true };

/**
 * A due status tick or expiry on its holder (the player's body, an NPC or an item; rows 1, G3);
 * an obsolete job completes harmlessly. Narration is the player's only.
 */
// size: allow 44, one due job saturates the tick, expires, or runs the fatal death sequence
export function runStatus(
  world: World,
  command: Pick<Command, 'id'>,
  job_id: JobId,
  job: JobRow,
  mint: Mint,
) {
  const done: DeltaOp = { op: 'job.complete', writer_group: 0, job_id };
  const status = job.job;
  const held = statusHolder(world, job_id);
  if (!held) return accepted<never>(world, 'job_ran', [done], []);
  const { body, row } = held;
  const spec = specOf(world, status);
  if (!spec) return { kind: 'fault', code: 'precondition_failed' } as const;
  const player = body === world.body;
  const now = job.due_time;
  const visit = { ...world, state: { ...world.state, clock: now } };
  const expired = now >= row.ends_at;
  const due = !expired && now >= row.next_tick_at;
  const { by, fatal } = due ? amount(visit, body, spec) : { by: 0, fatal: false };
  const ops: DeltaOp[] = [done];
  if (by) ops.push({ ...adjust(visit, body, spec.resource, by, {}).op, at: now });
  // A pack keeps fighting when one member falls, as in combat's own fatal round.
  const fight = fatal ? engaged(visit, body) : undefined;
  if (fight && (player || (fight.row.active_ids?.length ?? 1) === 1))
    ops.push(...closeEncounter(visit, body));
  if (expired) ops.push(...expire(visit, body, status, row, 0));
  else if (fatal) ops.push(endStatus(body, status, row, 0));
  const say = (key: TextKey) => (player ? [{ key }] : []);
  const events = due ? [happened(visit, command, mint, 'status_ticked', body, status)] : [];
  if (fatal) {
    const died = dies(visit, command, ops, player, mint);
    const all = [...events, ...died.events.map((e) => ({ ...e, position: 2 }))];
    return accepted(world, 'job_ran', ops, all, say(spec.narration.tick), died.rng);
  }
  if (expired) {
    const ended = [happened(visit, command, mint, 'status_expired', body, status)];
    return accepted(world, 'job_ran', ops, ended, say(spec.narration.expired));
  }
  // A due tick on an unreadable pool is skipped, never re-due at the same clock.
  const next_tick_at = due ? add(row.next_tick_at, spec.tick_every) : row.next_tick_at;
  ops.push(...successor(body, status, row, next_tick_at, mint() as JobId));
  return accepted(world, 'job_ran', ops, events, by ? say(spec.narration.tick) : []);
}

/**
 * A due tick's change, saturated at the pool bounds (the op itself stays exact), and whether it
 * takes hp to 0. An item has no pools: its tick changes nothing but still emits status_ticked.
 */
function amount(visit: World, body: EntityId, spec: StatusDefinition) {
  const current = level(visit, body, spec.resource);
  const pool = resourceSpec(visit, body, spec.resource);
  if (visit.entities[body]?.kind === 'item' || current === undefined || !pool)
    return { by: 0, fatal: false };
  const by = Math.max(pool.minimum - current, Math.min(pool.maximum - current, spec.per_tick));
  return { by, fatal: by < 0 && spec.resource.key === 'hp' && current + by === 0 };
}

// The ordinary death sequence after a fatal tick (ops[1] is its hp loss), with no killer; an NPC's
// drops roll from the world's RNG (row 8).
function dies(
  visit: World,
  command: Pick<Command, 'id'>,
  ops: DeltaOp[],
  player: boolean,
  mint: Mint,
) {
  const now = visit.state.clock;
  const died = deathSequence(
    prefix(visit, ops, now),
    command,
    {
      loss: ops[1] as Extract<DeltaOp, { op: 'resource.adjust' }>,
      owner_id: player ? visit.character : null,
      killer_id: null,
      credited_character_id: null,
    },
    mint,
    visit.state.rng,
  );
  ops.push(...died.ops.map((op) => (op.op === 'resource.adjust' ? { ...op, at: now } : op)));
  return died;
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
// statusStep, row G3).
export function statusGroup(
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
