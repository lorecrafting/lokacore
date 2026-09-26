// action_recipe@1 (capability_registry.json): perform one ActionRecipe of the cartridge as one
// logical decision (06 §20; 21 §7; 04 §5.2). step admits only an action of the actor's
// ActionSet whose policy holds (actions.ts refusal); here the key is re-resolved in that set: no
// recipe by that key is not_found, a target_id other than the recipe's detail invalid_target, the
// detail outside the actor's room not_present, then actions.ts admission: a perform before the
// actor's last admitted attempt plus the recipe's cooldown cooldown, and costs the actor's body
// cannot pay insufficient_resource. A rejection draws no RNG and changes nothing (04 §5.0).
// Accepted: the costs are paid first (resource.adjust ops); then a recipe's check (check@1) is
// resolved, a luck draw from the world's RNG or a threshold on a resource's value at admission,
// and emits check_passed or check_failed at position 1; its result selects the outcome, success
// or failure (the decision's outcome; performed for a recipe without a check), and a failure
// commits its costs, draw, cooldown, time and steps exactly like success (04 §5.0). Then that
// outcome's sequence in order: each fact.assign a delta op whose expected value is the fact as the
// steps before it left it, each resource.adjust one from the resource's value as the costs and
// steps before it left it, adding by and stopping at the bounds (none when that changes nothing), each event.emit a custom_event at its causal position; a fact.assign
// that changes its fact leaves the next position free for the fact_changed the host puts there
// (world.ts adopt). Then, unless the outcome is failure, action_completed, engine-owned; the actor
// reads the outcome's narration. A cooldown adds a cooldown.start at the admission time, and a
// duration one time.advance after the steps; events keep the admission time. Result bands join
// later.
import type {
  ActionRecipe,
  DeltaOp,
  EntityId,
  EventPayload,
  FactValue,
  RecipeStep,
} from '../contracts.gen.ts';
import { admission, detailOf, resolved } from '../actions.ts';
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
import { adjust, level, type Levels } from '../resource.ts';
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
  const admitted = admission(world, recipe, actor_id, body);
  if (typeof admitted === 'string') return rejected(admitted);
  const { paid, last, from } = admitted;
  const { check, duration } = recipe;
  const rolled = check && resolve(world, command, mint, check, subject_id, body);
  const { sequence, narration } = recipe.outcomes[rolled?.outcome ?? 'success']!;
  const start = { ...START, ops: paid.ops, levels: paid.levels };
  const begun = rolled ? { ...start, events: [rolled.event], position: 1 } : start;
  const run = sequence.reduce(step(world, command, mint, subject_id, body), begun);
  const done = { type: 'action_completed', action, subject_id } as const;
  const completed =
    rolled?.outcome === 'failure' ? [] : [event(world, command, mint, run.position + 1, done)];
  const since = last === undefined ? {} : { from: last };
  const cooldown: DeltaOp[] = recipe.cooldown
    ? [{ op: 'cooldown.start', writer_group: 0, actor_id, action, ...since, at: from }]
    : [];
  // ponytail: no jobs exist yet; once they do, this advance runs its due set like wait's
  // (04 §5.4: an action's time cost is an explicit advance that may not skip a due job).
  const time: DeltaOp[] = duration
    ? [{ op: 'time.advance', writer_group: 0, from, to: add(from, duration) }]
    : [];
  return accepted(
    world,
    rolled?.outcome ?? 'performed',
    [...run.ops, ...cooldown, ...time],
    [...run.events, ...completed],
    [{ key: narration.actor }],
    rolled?.rng,
  );
};

// ponytail: at most 8 draws; at bound 100 one is rejected with probability 96 / 2^32, so
// rng_budget_exhausted (which throws and discards the decision) is practically unreachable.
const DRAWS = 8;

// The check's result, its event at position 1 and the RNG after it: luck draws one uniform
// integer in [0, 100) and passes below chance; threshold draws nothing and passes when the
// body's value of the resource at admission (before costs) is at least difficulty
// (action.schema.json RecipeCheck).
function resolve(
  world: World,
  command: Command,
  mint: Mint,
  check: NonNullable<ActionRecipe['check']>,
  subject_id: EntityId,
  body: EntityId,
) {
  const [n, rng] =
    check.kind === 'luck' ? uniform(world.state.rng, 100, DRAWS) : [0, world.state.rng];
  const passed =
    check.kind === 'luck'
      ? n < check.chance
      : level(world, body, check.resource)! >= check.difficulty;
  const { id: cartridge_id, version: cartridge_version } = world.cartridge.manifest;
  const payload: CheckEvent = {
    type: passed ? 'check_passed' : 'check_failed',
    check: { cartridge_id, cartridge_version, kind: 'check', key: check.key },
    subject_id,
  };
  const outcome = passed ? ('success' as const) : ('failure' as const);
  return { outcome, rng, event: event(world, command, mint, 1, payload) };
}

type Command = Parameters<Rule<'action_recipe'>>[1];
type Run = {
  readonly ops: readonly DeltaOp[];
  readonly events: readonly ReturnType<typeof event<CustomEvent | CheckEvent>>[];
  readonly position: number;
  readonly facts: Readonly<Record<string, FactValue>>; // by MutationTarget text, as set so far
  readonly levels: Levels; // resource values as the costs and steps so far left them
};
type CustomEvent = Extract<EventPayload, { type: 'custom_event' }>;
type CheckEvent = Extract<EventPayload, { type: 'check_passed' | 'check_failed' }>;
const START: Run = { ops: [], events: [], position: 0, facts: {}, levels: {} };

// One step of the sequence over the run so far.
const step =
  (world: World, command: Command, mint: Mint, subject_id: EntityId, body: EntityId) =>
  (r: Run, s: RecipeStep): Run => {
    if (s.op === 'resource.adjust') {
      const { op, levels } = adjust(world, body, s.resource, s.by, r.levels, true);
      return op.from === op.to ? r : { ...r, ops: [...r.ops, op], levels };
    }
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
