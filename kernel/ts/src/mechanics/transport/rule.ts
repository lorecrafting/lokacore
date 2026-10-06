import { accepted, event, rejected, type Rule } from '../../runtime/decision.ts';
import { transition } from './shared.ts';

export const decide: Rule<'transport'> = (world, command, mint, steps) => {
  const result = transition(world, command.payload, steps);
  if ('code' in result)
    return result.code === 'budget_exceeded' || result.code === 'precondition_failed'
      ? { kind: 'fault', code: result.code }
      : rejected(result.code);
  const entered = event(world, command, mint, 1, {
    type: 'entity_entered_room',
    entity_id: result.body,
    room_id: result.there,
  });
  return accepted(
    world,
    'transport_used',
    result.ops,
    [entered],
    [{ key: result.route.narration }],
  );
};
