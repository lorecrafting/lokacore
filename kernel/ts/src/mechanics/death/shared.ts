import type { EntityId } from '../../contracts.gen.ts';
import type { World } from '../../runtime/decision.ts';
import { level, resourceRef } from '../resource.ts';
import { KernelError } from '../../foundation/error.ts';

/** Explicit NPC HP controls living presence; missing required rows are corruption. */
export function living(world: World, id: string): boolean {
  const e = world.entities[id];
  if (e?.kind !== 'npc' || !e.hp) return true;
  const hp = level(world, id as EntityId, resourceRef(world, 'hp'));
  if (hp === undefined) throw new KernelError('precondition_failed');
  return hp > 0;
}
