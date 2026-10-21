import type { CharacterId, EntityId } from '../contracts.gen.ts';
import type { Offered } from '../commands/actions.ts';
import type { Steps, World } from '../runtime/decision.ts';
import { ally, engaged } from '../mechanics/combat/shared.ts';
import { shooRefused } from '../mechanics/crow/behavior.ts';
import { describeEntity } from '../mechanics/description_variant/rule.ts';
import { living } from '../mechanics/death/shared.ts';
import { visible } from '../mechanics/light/shared.ts';
import { bandOf } from './resources.ts';
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
  return (
    a.command !== 'attack' ||
    (entity && entity.kind === 'npc' && !!entity.attack && !ally(world, actor, id as EntityId))
  );
}

type Fight = NonNullable<ReturnType<typeof engaged>>;
export function combatView(world: World, actor: CharacterId, fight: Fight, steps: Steps) {
  // A foe is always named (even unseen); its hp band word shows only when seen and alive: a pack
  // member a spell or status kills stays on the roster until the round-end prune (loka-y6yg.49).
  const foe = (id: EntityId) => ({
    name: describeEntity(world, actor, id, 'short', steps),
    ...(visible(world, actor, id, steps) &&
      living(world, id) && { band: bandOf(world, id, 'hp').band }),
  });
  return {
    encounter_id: fight.id,
    opponent_id: fight.row.npc_id,
    ...foe(fight.row.npc_id),
    ...(fight.row.active_ids && {
      active_opponents: fight.row.active_ids.map((id) => ({ id, ...foe(id) })),
    }),
  };
}
