// description_variant@1 (capability_registry.json): look at the current place (21 §6; 04 §14).
// Accepted with nothing to change; the host shows the GameView. Description variants join here.
import { accepted, type Rule } from '../decision.ts';

export const decide: Rule<'description_variant'> = (world) => accepted(world, 'looked', [], []);
