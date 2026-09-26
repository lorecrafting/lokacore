// description_variant@1 (capability_registry.json): look at the current place, or at one of its
// inspectable details (21 §6; 04 §14, §18). Accepted with nothing to change; the host shows the
// GameView or the detail, each described by describe(). A target_id is re-validated here,
// whatever resolved it: no detail by that id is not_found, a detail of another room not_present.
import type { CharacterId, DescriptionVariant, TextKey } from '../contracts.gen.ts';
import { accepted, has, rejected, type Rule, type World } from '../decision.ts';
import { holds } from '../policy.ts';

export const decide: Rule<'description_variant'> = (world, command) => {
  const { target_id } = command.payload;
  if (target_id === undefined) return accepted(world, 'looked', [], []);
  if (!has(world.details, target_id)) return rejected('not_found');
  if (world.details[target_id].room !== world.state.containers[world.body])
    return rejected('not_present');
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
