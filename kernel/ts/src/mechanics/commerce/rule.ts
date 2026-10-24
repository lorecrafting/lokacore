import { accepted, event, rejected, type Rule } from '../../runtime/decision.ts';
import { actorLine } from '../line.ts';
import { exchange } from './shared.ts';

export const decide: Rule<'commerce'> = (world, command, mint, steps = { n: 0 }) => {
  const p = command.payload;
  const line = p.type === 'buy' ? 'commerce.bought' : 'commerce.sold';
  const result = exchange(
    world,
    p.actor_id,
    p.provider_id,
    p.item_id,
    p.type,
    p.quoted_price,
    steps,
  );
  if (typeof result === 'string')
    return result === 'budget_exceeded' ||
      result === 'containment_cycle' ||
      result === 'precondition_failed'
      ? { kind: 'fault', code: result }
      : rejected(result === 'not_stolen' ? 'invalid_state' : result);
  const moved = {
    op: 'entity.transfer',
    writer_group: 0,
    entity_id: result.moved,
    source_id: result.source,
    destination_id: result.destination,
  } as const;
  return accepted(
    world,
    p.type === 'buy' ? 'bought' : 'sold',
    [moved, ...result.paid.ops],
    [
      event(world, command, mint, 1, {
        type: 'item_acquired',
        item_id: result.moved,
        holder_id: result.destination,
      }),
    ],
    [actorLine(world, p.actor_id, line, { item: result.moved }, steps)],
  );
};
