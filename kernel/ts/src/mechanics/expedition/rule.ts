import { accepted, rejected, type Rule } from '../../runtime/decision.ts';
import { choose } from './sequence.ts';

export const decide: Rule<'expedition'> = (world, command, mint, steps = { n: 0 }) => {
  const result = choose(world, command, mint, steps);
  return result.error !== undefined
    ? rejected(result.error)
    : accepted(world, command.payload.transition, result.ops, result.events, result.narration);
};
