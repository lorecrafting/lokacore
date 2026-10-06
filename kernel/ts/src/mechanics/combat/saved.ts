import { validate } from '../../foundation/validate.ts';
import { same } from '../../foundation/compose.ts';
import { bodyOf, type JobRow, type World } from '../../runtime/decision.ts';
import type { EncounterRow } from '../../contracts.gen.ts';
import { npcRef } from './shared.ts';
import { living } from '../death/shared.ts';
import { key } from '../../foundation/compose.ts';

/** Validate persisted combat authority before exposing a loaded/reconciled world. */
export function encountersValid(world: World): boolean {
  const occupied = new Set<string>();
  for (const [id, row] of Object.entries(world.state.encounters ?? {}))
    if (!encounterValid(world, id, row, occupied)) return false;
  return jobsValid(world);
}

function encounterValid(world: World, id: string, row: EncounterRow, occupied: Set<string>) {
  if (
    validate('EncounterId', id).length ||
    validate('EncounterRow', row).length ||
    !world.cartridge.world?.combat ||
    bodyOf(world, row.character_id) !== row.body_id ||
    !world.rooms[row.room_id] ||
    row.body_id === row.npc_id
  )
    return false;
  const npc = world.entities[row.npc_id];
  const job = world.state.jobs?.[row.job_id];
  const origin = world.state.created?.[row.npc_id]?.origin;
  const planBy = origin?.kind === 'spawned' ? origin.by : undefined;
  const plan = origin?.kind === 'spawned' ? world.populationSpecs[key(origin.by)]?.plan : undefined;
  const pack = !!plan?.pack;
  if (
    npc?.kind !== 'npc' ||
    !npc.attack ||
    !job ||
    job.encounter_id !== id ||
    !same(job.job, npcRef(world, row.npc_id)) ||
    pack !== (row.active_ids !== undefined) ||
    (pack && !packValid(world, row, plan!, planBy))
  )
    return false;
  if (row.status === 'closed' && job.status === 'pending') return false;
  return row.status !== 'open' || openValid(world, row, job, pack, occupied);
}

function packValid(world: World, row: EncounterRow, plan: { cap: number }, planBy: unknown) {
  const ids = row.active_ids!;
  if (row.status === 'closed') return !ids.length && row.next_opponent_id === null;
  return (
    !!ids.length &&
    ids.length <= plan.cap &&
    !ids.some((member, i) => {
      const origin = world.state.created?.[member]?.origin;
      return (
        (i > 0 && ids[i - 1] >= member) ||
        origin?.kind !== 'spawned' ||
        origin.role !== 'hound' ||
        origin.member_id !== member ||
        !same(origin.by, planBy)
      );
    }) &&
    ids.includes(row.npc_id) &&
    ids.includes(row.next_opponent_id!)
  );
}

function openValid(
  world: World,
  row: EncounterRow,
  job: JobRow,
  pack: boolean,
  occupied: Set<string>,
) {
  if (
    job.status !== 'pending' ||
    job.due_time <= world.state.clock ||
    occupied.has(row.body_id) ||
    (row.active_ids ?? [row.npc_id]).some((id) => occupied.has(id)) ||
    world.state.containers[row.body_id] !== row.room_id ||
    (!pack && !world.rooms[world.state.containers[row.npc_id]]) ||
    !living(world, row.body_id) ||
    (!pack && !living(world, row.npc_id))
  )
    return false;
  occupied.add(row.body_id);
  for (const id of row.active_ids ?? [row.npc_id]) occupied.add(id);
  return true;
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
