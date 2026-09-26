// description_variant@1 (capability_registry.json): look at the current place, or at one of its
// inspectable details (21 §6; 04 §14, §18). Accepted with nothing to change; the host shows the
// GameView or the detail. A target_id is re-validated here, whatever resolved it: no detail by
// that id is not_found, a detail of another room not_present. Description variants join here.
import { accepted, has, rejected, type Rule } from '../decision.ts';

export const decide: Rule<'description_variant'> = (world, command) => {
  const { target_id } = command.payload;
  if (target_id === undefined) return accepted(world, 'looked', [], []);
  if (!has(world.details, target_id)) return rejected('not_found');
  if (world.details[target_id].room !== world.state.containers[world.body])
    return rejected('not_present');
  return accepted(world, 'examined', [], []);
};
