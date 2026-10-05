import { validate } from '../../foundation/validate.ts';
import { same } from '../../foundation/compose.ts';
import { bodyOf, type World } from '../../runtime/decision.ts';
import { npcRef } from './shared.ts';
import { living } from '../death/shared.ts';

/** Validate persisted combat authority before exposing a loaded/reconciled world. */
export function encountersValid(world: World): boolean {
  const rows = world.state.encounters ?? {};
  const occupied = new Set<string>();
  for (const [id, row] of Object.entries(rows)) {
    if (
      validate('EncounterId', id).length ||
      validate('EncounterRow', row).length ||
      !world.cartridge.world?.combat ||
      bodyOf(world, row.character_id) !== row.body_id ||
      !world.rooms[row.room_id] ||
      row.body_id === row.npc_id
    )
      return false;
    const [npc, job] = [world.entities[row.npc_id], world.state.jobs?.[row.job_id]];
    if (
      npc?.kind !== 'npc' ||
      !npc.attack ||
      !job ||
      job.encounter_id !== id ||
      !same(job.job, npcRef(world, row.npc_id))
    )
      return false;
    if (row.status === 'closed' && job.status === 'pending') return false;
    if (row.status === 'open') {
      if (
        job.status !== 'pending' ||
        job.due_time <= world.state.clock ||
        occupied.has(row.body_id) ||
        occupied.has(row.npc_id) ||
        world.state.containers[row.body_id] !== row.room_id ||
        !world.rooms[world.state.containers[row.npc_id]] ||
        !living(world, row.body_id) ||
        !living(world, row.npc_id)
      )
        return false;
      occupied.add(row.body_id);
      occupied.add(row.npc_id);
    }
  }
  return jobsValid(world);
}

function jobsValid(world: World): boolean {
  const rows = world.state.encounters ?? {};
  const jobs = world.state.jobs ?? {};
  for (const [id, job] of Object.entries(jobs)) {
    if (job.encounter_id === undefined) continue;
    const { status, ...scheduled } = job;
    const row = rows[job.encounter_id];
    if (
      !row ||
      !['pending', 'completed', 'cancelled'].includes(status) ||
      validate('DeltaOp', { op: 'job.schedule', writer_group: 0, job_id: id, ...scheduled })
        .length ||
      !same(job.job, npcRef(world, row.npc_id)) ||
      (status === 'pending' && (row.status !== 'open' || row.job_id !== id))
    )
      return false;
  }
  return true;
}
