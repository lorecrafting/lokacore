// Planted violations of rule ownership (capability_registry.json through contracts.gen.ts
// Owned): each line below must be a type error, so `npm run typecheck` fails the day the Rule
// contract stops enforcing that a capability's rule takes only its commands and emits only its
// events. Limit: a cast (`as`) could evade it, so lint/rules/ts-rule-module-pure.yml bans casts
// in rules/.
import { accepted, event, type Rule } from '../src/decision.ts';
import * as movement from '../src/rules/movement.ts';

export const emitsForeign: Rule<'movement'> = (w, c, mint) =>
  // @ts-expect-error movement's rule may not emit containment's item_acquired.
  accepted(
    w,
    'x',
    [],
    [event(w, c, mint, 1, { type: 'item_acquired', item_id: w.body, holder_id: w.body })],
  );

// @ts-expect-error movement's rule takes move, so it cannot serve description_variant's look.
export const takesForeign: Rule<'description_variant'> = movement.decide;
