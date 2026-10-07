import type { CharacterId, EntityId } from '../contracts.gen.ts';
import type { Offered } from '../commands/actions.ts';
import type { World } from '../runtime/decision.ts';
import { engaged } from '../mechanics/combat/shared.ts';
import { shooRefused } from '../mechanics/crow/behavior.ts';
export function combatOffered(
  world: World,
  actor: CharacterId,
  body: EntityId | undefined,
  a: Offered,
  id?: string,
) {
  if (a.command === 'move' && body && engaged(world, body)) return false;
  if (a.command === 'flee') return !!body && !!engaged(world, body);
  if (a.command === 'shoo') return !!id && !shooRefused(world, actor, id as EntityId);
  const entity = id && world.entities[id];
  return a.command !== 'attack' || (entity && entity.kind === 'npc' && !!entity.attack);
}
