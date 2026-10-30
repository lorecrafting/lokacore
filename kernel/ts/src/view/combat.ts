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

// An entity's view name, with the name words of the base short or of the name variant shown (loka-6qi, W6).
export const named = (world: World, actor: CharacterId, id: EntityId, steps: Steps) => {
  const name = describeEntity(world, actor, id, 'short', steps);
  const e = world.entities[id];
  const words =
    name === e.short ? e.words : e.name_variants?.find((v) => v.description === name)?.words;
  return { name, ...(words && { words }) };
};

type Fight = NonNullable<ReturnType<typeof engaged>>;
export function combatView(world: World, actor: CharacterId, fight: Fight, steps: Steps) {
  // A foe is always named (even unseen); its hp band word shows only when seen and alive: a pack
  // member a spell or status kills stays on the roster until the round-end prune (loka-y6yg.49).
  const foe = (id: EntityId) => ({
    ...named(world, actor, id, steps),
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
