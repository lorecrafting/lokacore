import { accepted, type Rule } from '../../runtime/decision.ts';
import { locate } from './shared.ts';

export const decide: Rule<'knowledge'> = (world, command, _mint, steps = { n: 0 }) => ({
  ...accepted(world, 'located', [], []),
  location: locate(world, command.payload.actor_id, command.payload.target_id, steps),
});
