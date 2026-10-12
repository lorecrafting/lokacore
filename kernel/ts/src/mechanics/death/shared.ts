import type { EntityId } from '../../contracts.gen.ts';
import type { World } from '../../runtime/decision.ts';
import { level, resourceRef } from '../resource.ts';
import { KernelError } from '../../foundation/error.ts';
import { cmp } from '../../foundation/validate.ts';

/** Explicit NPC HP controls living presence; missing required rows are corruption. */
export function living(world: World, id: string): boolean {
  const e = world.entities[id];
  if (e?.kind !== 'npc' || !e.hp) return true;
  const hp = level(world, id as EntityId, resourceRef(world, 'hp'));
  if (hp === undefined) throw new KernelError('precondition_failed');
  return hp > 0;
}

/** The living NPCs directly in one of `rooms`, in EntityId order. Here, not in speech/shared: escort
 * needs it, and speech -> dialogue -> escort is an import cycle that blanks Metro's dev bundle. */
export const npcsIn = (w: World, rooms: readonly string[]) =>
  Object.keys(w.knownEntities)
    .filter(
      (id) =>
        w.knownEntities[id]!.kind === 'npc' &&
        rooms.includes(w.state.containers[id]!) &&
        living(w, id),
    )
    .sort(cmp) as EntityId[];
