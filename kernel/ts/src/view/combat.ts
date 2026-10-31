import type { CharacterId, EntityId } from '../contracts.gen.ts';
import type { Offered } from '../commands/actions.ts';
import type { Steps, World } from '../runtime/decision.ts';
import { ally, engaged } from '../mechanics/combat/shared.ts';
import { shooRefused } from '../mechanics/crow/behavior.ts';
import { holds } from '../mechanics/policy.ts';
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

// An entity's view name with its words: the first name variant that holds, else the base (loka-6qi, W6).
export const named = (world: World, actor: CharacterId, id: EntityId, steps: Steps) => {
  const e = world.entities[id];
  const v = e.name_variants?.find((v) => holds(world, actor, v.when, { target: id, steps }));
  const [name, words] = v ? [v.description, v.words] : [e.short, e.words];
  return { name, ...(words && { words }) };
};

type Fight = NonNullable<ReturnType<typeof engaged>>;
export function combatView(world: World, actor: CharacterId, fight: Fight, steps: Steps) {
  // A foe is always named (even unseen); its hp band word shows only when it has hp of its own (no
  // hp, no band: loka-ysbt ruling a, loka-zvwh), is seen and alive: a pack member a spell or status
  // kills stays on the roster until the round-end prune (loka-y6yg.49).
  const foe = (id: EntityId) => {
    const e = world.entities[id];
    const band =
      e?.kind === 'npc' && // mutate-skip: type narrowing only; a foe is always an NPC
      e.hp &&
      visible(world, actor, id, steps) &&
      living(world, id) &&
      bandOf(world, id, 'hp')?.band;
    return { ...named(world, actor, id, steps), ...(band && { band }) };
  };
  return {
    encounter_id: fight.id,
    opponent_id: fight.row.npc_id,
    ...foe(fight.row.npc_id),
    ...(fight.row.active_ids && {
      active_opponents: fight.row.active_ids.map((id) => ({ id, ...foe(id) })),
    }),
  };
}
