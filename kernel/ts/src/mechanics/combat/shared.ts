import type {
  CharacterId,
  DeltaOp,
  EncounterId,
  EncounterRow,
  EntityId,
} from '../../contracts.gen.ts';
import { bodyOf, refString, type Mint, type World } from '../../runtime/decision.ts';
import { living } from '../death/shared.ts';
import { add, divide, mul } from '../../foundation/int.ts';
import { standing } from '../position/shared.ts';
import { running } from '../scene/shared.ts';
import { key } from '../../foundation/compose.ts';
import { suppressed } from '../population/shared.ts';
import { statusResistance } from '../status/shared.ts';
import { member } from '../escort/shared.ts';
import { npcsIn } from '../death/shared.ts';

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
  if (
    npc.kind !== 'npc' ||
    !npc.attack ||
    !world.cartridge.world?.combat ||
    ally(world, actor, target)
  )
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
    (!retarget(world, body, target) && (engaged(world, body) || engaged(world, target))) ||
    running(world, actor)
  )
    return 'invalid_state' as const;
}

/** Toolbox row 6a: the player's open roster encounter when `target` is another active member
 * and the cartridge opts in; Attack then writes encounter.target instead of opening. */
export function retarget(world: World, body: EntityId, target: EntityId) {
  // Also gated by the ActionSet (commands/actions.ts resolved); kept so no caller of
  // attackRefused sees a relaxed admission in a cartridge without the opt-in.
  const fight = world.cartridge.world?.combat?.target_choice && engaged(world, body);
  return fight && fight.row.npc_id !== target && fight.row.active_ids?.includes(target)
    ? fight
    : undefined;
}

/** Toolbox row 6b: an authored NPC listed in world.combat.allies, or (row G8) a member of
 * `actor`'s group; never an attack target. */
export function ally(world: World, actor: CharacterId | null, id: EntityId | null) {
  return (
    !!world.cartridge.world?.combat?.allies?.some(
      (ref) => world.entityIds[refString(ref)] === id,
    ) ||
    (!!actor && !!id && member(world, actor, id))
  );
}

/** The ally that strikes this round: the first listed one living in the encounter room, else
 * the first group member there with an attack (EntityId order). */
export function allyOf(world: World, row: EncounterRow) {
  return (
    world.cartridge.world?.combat?.allies
      ?.map((ref) => world.entityIds[refString(ref)])
      .find((id) => id && living(world, id) && world.state.containers[id] === row.room_id) ??
    (world.cartridge.world?.group &&
      npcsIn(world, [row.room_id]).find((id) => {
        const npc = world.entities[id];
        return npc?.kind === 'npc' && !!npc.attack && member(world, row.character_id, id);
      }))
  );
}

/** A kill ends the fight only on its last opponent: a pack fights on (its roster pruned at round end). */
export const lastOpponent = (row: EncounterRow) => (row.active_ids?.length ?? 1) === 1;

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
    (created.origin.role === 'hound' || created.origin.role === 'deer') &&
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

/**
 * Toolbox row G2: `damage` on `target` after its resistances (its own and, status reader 5, its
 * active statuses'), the sum of their entries for each kind or material clamped to -100..100,
 * rounded down (a combat hit; row 29b a spell's damage).
 */
export function resisted(
  world: World,
  target: EntityId,
  kinds: readonly (string | undefined)[],
  damage: number,
) {
  const npc = world.entities[target];
  const resists = (npc?.kind === 'npc' && npc.resistances) || {};
  const held = statusResistance(world, target);
  const sum = kinds.reduce(
    (s, k) => (k ? add(add(s, resists[k as keyof typeof resists] ?? 0), held(k)) : s),
    0,
  );
  if (!sum) return damage;
  return divide(mul(damage, 100 - Math.min(100, Math.max(-100, sum))), 100)[0];
}
