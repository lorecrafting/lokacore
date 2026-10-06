import { accepted, rejected, type Rule } from '../../runtime/decision.ts';
import { transition } from './shared.ts';

export const decide: Rule<'food'> = (world, command, _mint, steps) => {
  const result = transition(world, command.payload, steps);
  if ('code' in result)
    return result.code === 'budget_exceeded' || result.code === 'precondition_failed'
      ? { kind: 'fault', code: result.code }
      : rejected(result.code);
  return {
    ...accepted(world, 'eaten', result.ops, [], [{ key: result.edible.narration }]),
    item_id: command.payload.item_id,
  };
};
