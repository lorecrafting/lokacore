import type { CharacterId, EntityId } from '../../contracts.gen.ts';
import { key } from '../../foundation/compose.ts';
import { present } from '../../commands/target.ts';
import { type Steps, type World } from '../../runtime/decision.ts';

export const observation = (world: World, actor: CharacterId, npc: EntityId) =>
  world.state.observed_npcs?.[key({ kind: 'observation', actor_id: actor, npc_id: npc })];

export function locate(world: World, actor: CharacterId, target: EntityId, steps: Steps) {
  if (world.entities[target]?.kind === 'npc' && present(world, actor, target, steps))
    return { target_id: target, status: 'here' as const, room_id: world.state.containers[target] };
  const seen = observation(world, actor, target);
  return seen
    ? { target_id: target, status: 'last_seen' as const, room_id: seen.room_id, at: seen.at }
    : { target_id: target, status: 'unknown' as const };
}
