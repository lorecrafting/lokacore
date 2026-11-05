import { accepted, event, rejected, type Rule } from '../../runtime/decision.ts';
import { liquidNarration, liquidPayload } from '../liquid/shared.ts';
import { applied, transition } from './shared.ts';

const FAULTS = ['budget_exceeded', 'precondition_failed', 'containment_cycle'];

export const decide: Rule<'food'> = (world, command, mint, steps) => {
  const p = command.payload;
  const result = transition(world, p, steps);
  if ('code' in result)
    return FAULTS.includes(result.code)
      ? { kind: 'fault', code: result.code }
      : rejected(result.code);
  if (result.drank) {
    // A vessel's Consume reads as liquid@1's drank (loka-kgd.209), then its liquid's statuses.
    const drank = liquidPayload(
      { type: 'drink', actor_id: p.actor_id, vessel_id: p.item_id },
      result.drank.kind,
      result.drank.quantity,
    );
    const first = event(world, command, mint, 1, drank);
    const after = applied(world, command, mint, result, 1);
    return accepted(
      world,
      'drank',
      [...result.ops, ...after.ops],
      [first, ...after.events],
      [...liquidNarration(world, drank, result.ops), ...after.lines],
    );
  }
  const meal = applied(world, command, mint, result);
  return {
    ...accepted(world, 'eaten', [...result.ops, ...meal.ops], meal.events, [
      { key: result.edible!.narration },
      ...meal.lines,
    ]),
    item_id: p.item_id,
  };
};
