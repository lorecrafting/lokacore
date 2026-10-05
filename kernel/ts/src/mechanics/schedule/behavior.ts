// behavior@1 (capability_registry.json definitions; 06 §13 Behavior/schedule profiles; 21 §10):
// an NPC's daily location schedule (entity.schema.json NpcDefinition daily_schedule), read by
// world creation and by schedule@1's run_job (mechanics/schedule/rule.ts).
import type { Command, DefinitionRef, DomainEvent, EntityId, JobId } from '../../contracts.gen.ts';
import {
  refString,
  type Cartridge,
  type JobRow,
  type Mint,
  type World,
} from '../../runtime/decision.ts';
import { cmp } from '../../foundation/validate.ts';
import { hourOf, nextHour } from '../calendar.ts';
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
  return jobs;
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
