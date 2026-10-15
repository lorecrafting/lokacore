import { accepted, rejected, type Rule } from '../../runtime/decision.ts';
import { applied, transition } from './shared.ts';

export const decide: Rule<'food'> = (world, command, mint, steps) => {
  const result = transition(world, command.payload, steps);
  if ('code' in result)
    return result.code === 'budget_exceeded' || result.code === 'precondition_failed'
      ? { kind: 'fault', code: result.code }
      : rejected(result.code);
  const meal = applied(world, command, mint, result.edible);
  return {
    ...accepted(world, 'eaten', [...result.ops, ...meal.ops], meal.events, [
      { key: result.edible.narration },
      ...meal.lines,
    ]),
    item_id: command.payload.item_id,
  };
};
