import { accepted, rejected, type Rule } from '../../runtime/decision.ts';
import { scheduled, transition } from './shared.ts';

export const decide: Rule<'service'> = (world, command, mint, steps) => {
  const result = transition(world, command.payload, steps);
  if ('code' in result)
    return result.code === 'budget_exceeded' ||
      result.code === 'precondition_failed' ||
      result.code === 'containment_cycle'
      ? { kind: 'fault', code: result.code }
      : rejected(result.code);
  const ops = [...result.ops, ...scheduled(world, command.payload, result.service, mint)];
  return accepted(world, 'service_used', ops, [], [{ key: result.service.narration }]);
};
