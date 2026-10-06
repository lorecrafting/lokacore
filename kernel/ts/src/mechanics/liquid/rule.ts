import { accepted, event, rejected, type Rule } from '../../runtime/decision.ts';
import { transition, liquidNarration, liquidPayload } from './shared.ts';

export const decide: Rule<'liquid'> = (world, command, mint, steps) => {
  const p = command.payload;
  const result = transition(world, p, steps);
  if (typeof result === 'string')
    return result === 'budget_exceeded' ||
      result === 'containment_cycle' ||
      result === 'precondition_failed'
      ? { kind: 'fault', code: result }
      : rejected(result);
  const { kind, quantity } = result;
  const payload = liquidPayload(p, kind, quantity);
  return accepted(
    world,
    payload.type,
    result.ops,
    [event(world, command, mint, 1, payload)],
    liquidNarration(world, payload.type, kind, quantity),
  );
};
