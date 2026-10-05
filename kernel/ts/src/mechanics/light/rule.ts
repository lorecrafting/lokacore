import { accepted, rejected, type Rule } from '../../runtime/decision.ts';
import { transition } from './shared.ts';
export const decide: Rule<'light'> = (world, command) => {
  const p = command.payload;
  const next = transition(
    world,
    p.actor_id,
    p.type,
    p.item_id,
    p.type === 'refuel' ? p.supply_id : undefined,
  );
  return typeof next === 'string'
    ? rejected(next)
    : accepted(world, next.outcome, next.ops, [], next.narration);
};
