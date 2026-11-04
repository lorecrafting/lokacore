// death@1 corpse decay (owner decision 2026-11-02): items spill to the room, the corpse leaves play.
import type { DeltaOp, EntityId, JobId } from '../../contracts.gen.ts';
import { accepted, type JobRow, type Mint, type World } from '../../runtime/decision.ts';
import { cmp } from '../../foundation/validate.ts';

/** The decay job a death schedules, or none when the world sets no decay for this victim. */
export function decayJob(
  world: World,
  corpse_id: EntityId,
  player: boolean,
  writer_group: number,
  mint: Mint,
): DeltaOp[] {
  const death = world.cartridge.world!.death!;
  const after = player ? death.player_corpse_decay : death.npc_corpse_decay;
  if (after === undefined) return [];
  const { id: cartridge_id, version: cartridge_version } = world.cartridge.manifest;
  return [
    {
      op: 'job.schedule',
      writer_group,
      job_id: mint() as JobId,
      job: { cartridge_id, cartridge_version, kind: 'decay', key: 'corpse' },
      due_time: world.state.clock + after,
      corpse_id,
    },
  ];
}

/** Direct children to the room in EntityId order, then the corpse to the consumed holder. */
export function runDecay(world: World, job_id: JobId, job: JobRow) {
  const corpse = job.corpse_id!;
  const room = world.state.containers[corpse];
  const done: DeltaOp = { op: 'job.complete', writer_group: 0, job_id };
  if (!room || !world.rooms[room]) return accepted<never>(world, 'job_ran', [done], []);
  const move = (entity_id: string, source_id: string, destination_id: string): DeltaOp => ({
    op: 'entity.transfer',
    writer_group: 0,
    entity_id: entity_id as EntityId,
    source_id: source_id as EntityId,
    destination_id: destination_id as EntityId,
  });
  const spilled = Object.keys(world.state.containers)
    .filter((id) => world.state.containers[id] === corpse)
    .sort(cmp)
    .map((id) => move(id, corpse, room));
  return accepted<never>(
    world,
    'job_ran',
    [done, ...spilled, move(corpse, room, world.consumed!)],
    [],
  );
}
