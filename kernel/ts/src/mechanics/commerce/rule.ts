import { accepted, event, rejected, type Rule } from '../../runtime/decision.ts';
import { exchange } from './shared.ts';

export const decide: Rule<'commerce'> = (world, command, mint, steps) => {
  const p = command.payload;
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
      : rejected(result);
  const moved = {
    op: 'entity.transfer',
    writer_group: 0,
    entity_id: p.item_id,
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
        item_id: p.item_id,
        holder_id: result.destination,
      }),
    ],
    [{ key: p.type === 'buy' ? result.shop.bought : result.shop.sold }],
  );
};
