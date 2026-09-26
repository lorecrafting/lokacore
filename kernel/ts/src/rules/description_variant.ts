// description_variant@1 (capability_registry.json): look at the current place, or examine one
// of its inspectable details, an item or NPC in it, or an item the actor holds (21 §6, §8; 04
// §14, §18). Accepted with nothing to change; the host shows the GameView or the thing, each
// described by describe(). A target_id is re-validated here, whatever resolved it: no detail or
// entity by that id is not_found, one elsewhere not_present.
import type { CharacterId, DescriptionVariant, TextKey } from '../contracts.gen.ts';
import { accepted, bodyOf, has, rejected, type Rule, type World } from '../decision.ts';
import { holds } from '../policy.ts';

export const decide: Rule<'description_variant'> = (world, command) => {
  const { actor_id, target_id } = command.payload;
  if (target_id === undefined) return accepted(world, 'looked', [], []);
  const body = bodyOf(world, actor_id);
  const detail = has(world.details, target_id);
  if (!body || !(detail || has(world.entities, target_id))) return rejected('not_found');
  const here = world.state.containers[body];
  const at = detail ? world.details[target_id].room : world.state.containers[target_id];
  if (at !== here && at !== body) return rejected('not_present');
  return accepted(world, 'examined', [], []);
};

/**
 * The description `actor` sees of a room or detail (21 §6 DescriptionVariant; room.schema.json):
 * the first variant whose condition holds, else the base description.
 */
export const describe = (
  world: World,
  actor: CharacterId,
  of: { readonly description: TextKey; readonly variants?: readonly DescriptionVariant[] },
): TextKey =>
  of.variants?.find((v) => holds(world, actor, v.when.root))?.description ?? of.description;
