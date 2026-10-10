// behavior@1 (capability_registry.json definitions; 06 §13 Behavior/schedule profiles; 21 §10):
// an NPC's daily location schedule (entity.schema.json NpcDefinition daily_schedule), read by
// world creation and by schedule@1's run_job (mechanics/schedule/rule.ts); and the world's calendar job below.
import type { Command, DefinitionRef, DomainEvent, EntityId, JobId } from '../../contracts.gen.ts';
import {
  accepted,
  refString,
  type Cartridge,
  type JobRow,
  type Mint,
  type World,
} from '../../runtime/decision.ts';
import { cmp } from '../../foundation/validate.ts';
import { hourOf, nextHour, units } from '../calendar.ts';
export { hourOf, nextHour };

/** The daily schedule of the NPC `npc` names: hour of day to room; empty when it has none. */
export function scheduleOf(
  world: World,
  npc: DefinitionRef,
): Readonly<Record<string, DefinitionRef>> {
  const e = world.entities[world.entityIds[refString(npc)]];
  return (e?.kind === 'npc' && e.daily_schedule) || {};
}

export const jobId = (mint: Mint) => mint() as JobId;

/**
 * A fresh world's jobs (world creation, numeric profile Initial world ids): one per NPC with a
 * non-empty daily schedule, in DefinitionRefString order, its id the next of `mint`, pending at
 * the schedule's first listed hour strictly after `clock` (04 §5.4: strictly later than now).
 */
export function firstJobs(cartridge: Cartridge, clock: number, mint: Mint) {
  const { id: cartridge_id, version: cartridge_version } = cartridge.manifest;
  const jobs: Record<string, JobRow> = {};
  for (const [, n] of Object.entries(cartridge.npcs ?? {}).sort(([a], [b]) => cmp(a, b)))
    if (Object.keys(n.daily_schedule ?? {}).length) {
      const job = { cartridge_id, cartridge_version, kind: 'npc', key: n.key };
      jobs[mint()] = {
        job,
        due_time: nextHour(cartridge, n.daily_schedule!, clock),
        status: 'pending',
      };
    }
  return { ...jobs, ...firstClock(cartridge, clock, mint) };
}

/**
 * The entity_entered_room of `npc` entering `room` in run_job `run` (movement@1's event, as a
 * move reports it): its id the run's next ordinal, at the job's due time `at` (the visited time,
 * 04 §5.4), instance scope (no actor moved it), position 1 and the run as cause and correlation
 * (the host's drain renumbers the position and correlates it to the advance's command).
 */
export const entered = (
  world: World,
  run: Pick<Command, 'id'>,
  mint: Mint,
  npc: EntityId,
  room: EntityId,
  at: number,
) => ({
  id: mint() as DomainEvent['id'],
  world_context_id: world.context,
  scope: { kind: 'instance', world_context_id: world.context } as const,
  logical_time: at,
  position: 1,
  causation_id: run.id as string as DomainEvent['causation_id'],
  correlation_id: run.id as string as DomainEvent['correlation_id'],
  payload: { type: 'entity_entered_room', entity_id: npc, room_id: room } as const,
});

// schedule@1's calendar job (toolbox row W25; docs/system/mechanics.md exposure): one pending job
// per world, only while the cartridge has a clock_hour reaction. A run emits one clock_hour at the
// committed clock and schedules the next at the first hour boundary strictly after it, so a
// settlement crossing many hours fires once (catch-up collapses) and reads nothing but the clock.
// The host never stops an elapsed step at this job (mobile/authority/local-story/elapsed.ts).
export const CLOCK_JOB = 'calendar';

const hourAfter = (cartridge: Cartridge, time: number) => {
  const { hour } = units(cartridge);
  return time - (time % hour) + hour;
};

/** The world's first calendar job, when a reaction listens for clock_hour. */
export function firstClock(
  cartridge: Cartridge,
  clock: number,
  mint: Mint,
): Record<string, JobRow> {
  if (!Object.values(cartridge.reactions ?? {}).some((r) => r.on.event === 'clock_hour')) return {};
  const { id: cartridge_id, version: cartridge_version } = cartridge.manifest;
  const job = { cartridge_id, cartridge_version, kind: CLOCK_JOB, key: 'clock_hour' };
  return { [mint()]: { job, due_time: hourAfter(cartridge, clock), status: 'pending' } };
}

/** One due calendar job: clock_hour now, then the next hour boundary after the committed clock. */
export function runClock(
  world: World,
  run: Pick<Command, 'id'>,
  job_id: JobId,
  row: JobRow,
  mint: Mint,
) {
  const now = world.state.clock;
  const due_time = hourAfter(world.cartridge, now);
  const next = mint() as JobId;
  const clockHour = {
    id: mint() as DomainEvent['id'],
    world_context_id: world.context,
    scope: { kind: 'instance', world_context_id: world.context } as const,
    logical_time: now,
    position: 1,
    causation_id: run.id as string as DomainEvent['causation_id'],
    correlation_id: run.id as string as DomainEvent['correlation_id'],
    payload: { type: 'clock_hour' } as const,
  };
  return accepted(
    world,
    'job_ran',
    [
      { op: 'job.complete', writer_group: 0, job_id },
      { op: 'job.schedule', writer_group: 0, job_id: next, job: row.job, due_time },
    ],
    [clockHour],
  );
}
