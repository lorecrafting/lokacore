// action_recipe@1 (capability_registry.json): perform one ActionRecipe of the cartridge as one
// logical decision (06 §20; 21 §7; 04 §5.2). step admits only an action of the actor's
// ActionSet whose policy holds (actions.ts refusal); here the key is re-resolved in that set: no
// recipe by that key is not_found, a target_id other than the recipe's detail invalid_target, and
// the detail outside the actor's room not_present. A rejection draws no RNG and changes nothing.
// Accepted: a recipe's check (check@1) is resolved first, one luck draw from the world's RNG, and
// emits check_passed or check_failed at position 1; its result selects the outcome, success or
// failure (the decision's outcome; performed for a recipe without a check), and a failure commits
// its draw, time and steps exactly like success (04 §5.0). Then that outcome's sequence in order,
// each fact.assign a delta op whose expected value is the fact as the steps before it left it,
// each event.emit a custom_event at its causal position; a fact.assign that changes its fact
// leaves the next position free for the fact_changed the host puts there (world.ts adopt). Then
// action_completed, engine-owned, and the actor reads the outcome's narration. A duration adds
// one time.advance after the steps; events keep the admission time. Costs, cooldowns and result
// bands join in S6b and later.
import type {
  DeltaOp,
  EntityId,
  EventPayload,
  FactValue,
  RecipeCheck,
  RecipeStep,
} from '../contracts.gen.ts';
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
import { add } from '../int.ts';
import { uniform } from '../rng.ts';

export const decide: Rule<'action_recipe'> = (world, command, mint) => {
  const { actor_id, action, target_id } = command.payload;
  const recipe = resolved(world, actor_id)[action]?.recipe;
  const body = bodyOf(world, actor_id);
  if (!recipe || !body) return rejected('not_found');
  const subject_id = detailOf(world, recipe.target);
  if (target_id !== undefined && target_id !== subject_id) return rejected('invalid_target');
  if (world.details[subject_id].room !== world.state.containers[body])
    return rejected('not_present');
  const { check, duration } = recipe;
  const rolled = check && roll(world, command, mint, check, subject_id);
  const { sequence, narration } = recipe.outcomes[rolled?.outcome ?? 'success']!;
  const start = rolled ? { ...START, events: [rolled.event], position: 1 } : START;
  const { ops, events, position } = sequence.reduce(step(world, command, mint, subject_id), start);
  const done = { type: 'action_completed', action, subject_id } as const;
  const completed = event(world, command, mint, position + 1, done);
  const from = world.state.clock;
  const time: DeltaOp[] = duration
    ? [{ op: 'time.advance', writer_group: 0, from, to: add(from, duration) }]
    : [];
  return accepted(
    world,
    rolled?.outcome ?? 'performed',
    [...ops, ...time],
    [...events, completed],
    [{ key: narration.actor }],
    rolled?.rng,
  );
};

// ponytail: at most 8 draws; at bound 100 one is rejected with probability 96 / 2^32, so
// rng_budget_exhausted (which throws and discards the decision) is practically unreachable.
const DRAWS = 8;

// The check's luck roll: one uniform draw in [0, 100), passing below chance (action.schema.json
// RecipeCheck), its event at position 1 and the RNG after the draw.
function roll(
  world: World,
  command: Command,
  mint: Mint,
  check: RecipeCheck,
  subject_id: EntityId,
) {
  const [n, rng] = uniform(world.state.rng, 100, DRAWS);
  const passed = n < check.chance;
  const { id: cartridge_id, version: cartridge_version } = world.cartridge.manifest;
  const payload: CheckEvent = {
    type: passed ? 'check_passed' : 'check_failed',
    check: { cartridge_id, cartridge_version, kind: 'check', key: check.key },
    subject_id,
  };
  const e = event(world, command, mint, 1, payload);
  return {
    outcome: passed ? ('success' as const) : ('failure' as const),
    rng,
    event: e,
  };
}

type Command = Parameters<Rule<'action_recipe'>>[1];
type Run = {
  readonly ops: readonly DeltaOp[];
  readonly events: readonly ReturnType<typeof event<CustomEvent | CheckEvent>>[];
  readonly position: number;
  readonly facts: Readonly<Record<string, FactValue>>; // by MutationTarget text, as set so far
};
type CustomEvent = Extract<EventPayload, { type: 'custom_event' }>;
type CheckEvent = Extract<EventPayload, { type: 'check_passed' | 'check_failed' }>;
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
