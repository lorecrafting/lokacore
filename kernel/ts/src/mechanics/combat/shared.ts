import type {
  CharacterId,
  DeltaOp,
  EncounterId,
  EncounterRow,
  EntityId,
} from '../../contracts.gen.ts';
import { bodyOf, refString, type Mint, type World } from '../../runtime/decision.ts';
import { living } from '../death/shared.ts';
import { standing } from '../position/shared.ts';
import { running } from '../scene/shared.ts';
import { key } from '../../foundation/compose.ts';
import { suppressed } from '../population/shared.ts';

/** One finite current encounter, shared by admission, escape, due jobs and projection. */
export function engaged(world: World, body: EntityId) {
  const found = Object.entries(world.state.encounters ?? {}).find(
    ([, row]) =>
      row.status === 'open' &&
      (row.body_id === body || (row.active_ids ?? [row.npc_id]).includes(body)),
  );
  return found && { id: found[0] as EncounterId, row: found[1] };
}

export function attackRefused(world: World, actor: CharacterId, target: EntityId) {
  const body = bodyOf(world, actor);
  if (!body) return 'not_found' as const;
  const npc = world.entities[target];
  if (!npc) return 'not_found' as const;
  if (npc.kind !== 'npc' || !npc.attack || !world.cartridge.world?.combat)
    return 'invalid_target' as const;
  const origin = world.state.created?.[target]?.origin;
  if (
    origin?.kind === 'spawned' &&
    origin.role === 'hound' &&
    world.populationSpecs[key(origin.by)]?.plan.pack &&
    suppressed(world, origin.by)
  )
    return 'invalid_state' as const;
  const room = world.state.containers[body];
  if (!world.rooms[room] || world.state.containers[target] !== room) return 'not_present' as const;
  if (
    !living(world, body) ||
    !living(world, target) ||
    !standing(world, actor) ||
    world.rooms[room].sanctuary ||
    engaged(world, body) ||
    engaged(world, target) ||
    running(world, actor)
  )
    return 'invalid_state' as const;
}

export function closeEncounter(world: World, body: EntityId): DeltaOp[] {
  const fight = engaged(world, body);
  if (!fight) return [];
  const { id: encounter_id, row } = fight;
  return [
    {
      op: 'encounter.close',
      writer_group: 0,
      encounter_id,
      job_id: row.job_id,
      ...(row.active_ids && { expected: row }),
    },
    { op: 'job.cancel', writer_group: 0, encounter_id, job_id: row.job_id },
  ];
}

/** Authored NPC definition corresponding to an exact fresh instance. */
export function npcRef(world: World, id: EntityId) {
  const created = world.state.created?.[id];
  if (
    created?.origin.kind === 'spawned' &&
    created.origin.role === 'hound' &&
    created.origin.member_id === id
  )
    return created.definition;
  const npc = world.entities[id];
  const ref = {
    cartridge_id: world.cartridge.manifest.id,
    cartridge_version: world.cartridge.manifest.version,
    kind: 'npc',
    key: npc.key,
  };
  return world.entityIds[refString(ref)] === id ? ref : undefined;
}

export function participantsPresent(world: World, row: EncounterRow) {
  return (
    living(world, row.body_id) &&
    living(world, row.npc_id) &&
    world.state.containers[row.body_id] === row.room_id &&
    world.state.containers[row.npc_id] === row.room_id
  );
}

export const encounterId = (mint: Mint) => mint() as EncounterId;
