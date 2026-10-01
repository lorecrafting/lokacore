// behavior@1 (capability_registry.json definitions; 06 §13 Behavior/schedule profiles; 21 §10):
// an NPC's daily location schedule (entity.schema.json NpcDefinition daily_schedule), read by
// world creation and by schedule@1's run_job (rules/schedule.ts).
import type { DefinitionRef, JobId } from './contracts.gen.ts';
import { refString, type Cartridge, type JobRow, type Mint, type World } from './decision.ts';
import { cmp } from './validate.ts';

/** The daily schedule of the NPC `npc` names: hour of day to room; empty when it has none. */
export function scheduleOf(
  world: World,
  npc: DefinitionRef,
): Readonly<Record<string, DefinitionRef>> {
  const e = world.entities[world.entityIds[refString(npc)]];
  return (e?.kind === 'npc' && e.daily_schedule) || {};
}

/** The hour of day of logical time `t` (command.schema.json LogicalTime). */
export const hourOf = (t: number) => Math.floor(t / 3600) % 24;

/**
 * The first listed hour of a non-empty `schedule` strictly after time `t`: today's, else the
 * first one tomorrow.
 */
export function next(schedule: Readonly<Record<string, unknown>>, t: number): number {
  const day = t - (t % 86400);
  return Math.min(
    ...Object.keys(schedule).map((h) => {
      const at = day + Number(h) * 3600;
      return at > t ? at : at + 86400;
    }),
  );
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
      jobs[mint()] = { job, due_time: next(n.daily_schedule!, clock), status: 'pending' };
    }
  return jobs;
}
