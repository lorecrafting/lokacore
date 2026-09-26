// action_recipe@1 (capability_registry.json): perform one ActionRecipe of the cartridge as one
// logical decision (06 §20; 21 §7; 04 §5.2). step admits only an action of the actor's
// ActionSet whose policy holds (actions.ts refusal); here the key is re-resolved in that set: no
// recipe by that key is not_found, a target_id other than the recipe's detail invalid_target, and
// the detail outside the actor's room not_present. Accepted: the success sequence in order, each
// fact.assign a delta op whose expected value is the fact as the steps before it left it, each
// event.emit a custom_event at its causal position; a fact.assign that changes its fact leaves
// the next position free for the fact_changed the host puts there (world.ts adopt). Then
// action_completed, engine-owned, and the actor reads the narration. Costs, checks and result
// bands join here in S6.
import type { DeltaOp, EntityId, EventPayload, FactValue, RecipeStep } from '../contracts.gen.ts';
import { detailOf, resolved } from '../actions.ts';
import { key, same } from '../compose.ts';
import {
  accepted,
  bodyOf,
  event,
  has,
  rejected,
  type Mint,
  type Rule,
  type World,
} from '../decision.ts';
import { scopeOf, value } from '../fact.ts';

export const decide: Rule<'action_recipe'> = (world, command, mint) => {
  const { actor_id, action, target_id } = command.payload;
  const recipe = resolved(world, actor_id)[action]?.recipe;
  const body = bodyOf(world, actor_id);
  if (!recipe || !body) return rejected('not_found');
  const subject_id = detailOf(world, recipe.target);
  if (target_id !== undefined && target_id !== subject_id) return rejected('invalid_target');
  if (world.details[subject_id].room !== world.state.containers[body])
    return rejected('not_present');
  const { sequence, narration } = recipe.outcomes.success;
  const { ops, events, position } = sequence.reduce(step(world, command, mint, subject_id), START);
  const done = { type: 'action_completed', action, subject_id } as const;
  const completed = event(world, command, mint, position + 1, done);
  return accepted(world, 'performed', ops, [...events, completed], [{ key: narration.actor }]);
};

type Command = Parameters<Rule<'action_recipe'>>[1];
type Run = {
  readonly ops: readonly DeltaOp[];
  readonly events: readonly ReturnType<typeof event<CustomEvent>>[];
  readonly position: number;
  readonly facts: Readonly<Record<string, FactValue>>; // by MutationTarget text, as set so far
};
type CustomEvent = Extract<EventPayload, { type: 'custom_event' }>;
const START: Run = { ops: [], events: [], position: 0, facts: {} };

// One step of the sequence over the run so far.
const step =
  (world: World, command: Command, mint: Mint, subject_id: EntityId) =>
  (r: Run, s: RecipeStep): Run => {
    if (s.op === 'event.emit') {
      const { id: cartridge_id, version: cartridge_version } = world.cartridge.manifest;
      const payload: CustomEvent = {
        type: 'custom_event',
        event: { cartridge_id, cartridge_version, kind: 'event', key: s.event },
        subject_id,
      };
      const e = event(world, command, mint, r.position + 1, payload);
      return { ...r, position: r.position + 1, events: [...r.events, e] };
    }
    const actor = command.payload.actor_id;
    const scope = scopeOf(world, actor, s.fact);
    const at = key({ kind: 'fact', fact: s.fact, scope });
    const expected = has(r.facts, at) ? r.facts[at] : value(world, actor, s.fact);
    const op = {
      op: 'fact.assign',
      writer_group: 0,
      fact: s.fact,
      scope,
      expected,
      value: s.value,
    } as const;
    const position = r.position + (same(expected, s.value) ? 0 : 1);
    return { ...r, ops: [...r.ops, op], position, facts: { ...r.facts, [at]: s.value } };
  };
