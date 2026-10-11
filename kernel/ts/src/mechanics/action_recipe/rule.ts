// action_recipe@1 (capability_registry.json): perform one ActionRecipe of the cartridge as one
// logical decision (06 §20; 21 §7; 04 §5.2). step admits only an action of the actor's
// ActionSet whose policy holds (commands/actions.ts refusal); here the key is re-resolved in that set: no
// recipe by that key is not_found, a target_id other than the recipe's detail invalid_target, the
// detail outside the actor's room not_present, then commands/actions.ts admission: a perform before the
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
// (runtime/proposal.ts adopt). Then, unless the outcome is failure, action_completed, engine-owned; the actor
// reads the outcome's narration, each of its participants pinned here to its EntityId (an NPC's
// or item's, the actor's body), so the committed line never resolves them again (06 §43). A cooldown adds a cooldown.start at the admission time, and a
// duration one time.advance after the steps (the host runs its due jobs in this proposal,
// runtime/proposal.ts propose; 04 §5.4); events keep the admission time. A recipe with a tip
// (toolbox row W23) first assigns its seen_tip_<key> after the steps, while unseen, and the actor
// then also reads the tip after the outcome's line. Result bands join later. A use recipe
// (toolbox row G4) acts on the invoked target with the invoked held tool (shared.ts useRefused); its
// status.cure steps end the target's active status (status/shared.ts cureOps). A spell (toolbox row
// 29a) is the same run, reached by cast's word instead of perform's key (shared.ts spellOf; step's
// castAdmission refused an unknown or barred word).
import type {
  ActionRecipe,
  CharacterId,
  DefinitionRef,
  DeltaOp,
  EntityId,
  EventPayload,
  FactValue,
  NarrationParticipant,
  RecipeNarration,
  RecipeStep,
  RecipeTarget,
} from '../../contracts.gen.ts';
import { admission, detailOf, resolved } from '../../commands/actions.ts';
import {
  accepted,
  bodyOf,
  event,
  keys,
  refString,
  rejected,
  type Mint,
  type Rule,
  type Steps,
  type World,
} from '../../runtime/decision.ts';
import { assigned, seenTip, value } from '../fact.ts';
import { add } from '../../foundation/int.ts';
import { adjust, level } from '../resource.ts';
import { value as attributeValue } from '../attributes/shared.ts';
import { uniform } from '../../foundation/rng.ts';
import { opposed, practised } from '../skills.ts';
import { cureOps } from '../status/shared.ts';
import { spellOf, useRefused } from './shared.ts';
import { effect, fightBack, type Effected } from './spell.ts';

export const decide: Rule<'action_recipe'> = (world, command, mint, steps = { n: 0 }) => {
  const p = command.payload;
  const recipe = recipeOf(world, p);
  const body = bodyOf(world, p.actor_id);
  if (!recipe || !body) return rejected(p.type === 'cast' ? 'invalid_state' : 'not_found');
  const { actor_id } = p;
  const action = recipe.key;
  const subject_id = subjectOf(world, recipe.target, p, body, steps);
  if (typeof subject_id !== 'string') return subject_id;
  const admitted = admission(world, recipe, actor_id, body);
  if (typeof admitted === 'string') return rejected(admitted);
  const { paid, last, from } = admitted;
  const { check, duration } = recipe;
  const rolled = check && resolve(world, command, mint, check, subject_id, body);
  const { sequence, narration } = recipe.outcomes[rolled?.outcome ?? 'success']!;
  const start: Run = { ...START, ...paid, rng: rolled?.rng ?? world.state.rng }; // row 29b: a kill's drops
  const checked = rolled ? { ...start, events: [rolled.event], position: 1 } : start;
  const begun = practised(world, actor_id, checked, check); // after the check reads the level
  const ran = sequence.reduce(step(world, command, mint, subject_id, body), begun);
  const end = duration ? add(from, duration) : from; // a fight's first round never inside the cast
  const run = tip(world, actor_id, recipe, fightBack(world, actor_id, body, ran, mint, end));
  const said = { key: narration.actor, ...pinned(world, narration.participants, body) };
  const done = { type: 'action_completed', action, subject_id } as const;
  const completed =
    rolled?.outcome === 'failure' ? [] : [event(world, command, mint, run.position + 1, done)];
  const since = last === undefined ? {} : { from: last };
  const cooldown: DeltaOp[] = recipe.cooldown
    ? [{ op: 'cooldown.start', writer_group: 0, actor_id, action, ...since, at: from }]
    : [];
  const time: DeltaOp[] = duration ? [{ op: 'time.advance', writer_group: 0, from, to: end }] : [];
  return accepted(
    world,
    rolled?.outcome ?? 'performed',
    [...run.ops, ...cooldown, ...time],
    [...run.events, ...completed],
    [said, ...run.lines],
    run.rng,
  );
};

// The recipe a perform names by key in the actor's set, or (row 29a) the spell a cast names by word.
const recipeOf = (world: World, p: Command['payload']) =>
  p.type === 'cast' ? spellOf(world, p.word) : resolved(world, p.actor_id)[p.action]?.recipe;

// The entity the recipe acts on, or the decision refusing it: its detail, in the actor's room (no
// item_id; a target_id must be it); or (row G4) a use's invoked target (shared.ts useRefused; a reach
// fault faults the decision); or (row 29a) a spell's caster's body.
function subjectOf(
  world: World,
  target: RecipeTarget,
  p: Command['payload'],
  body: EntityId,
  steps: Steps,
) {
  if (target.kind === 'spell') return body;
  if (p.type === 'cast') return rejected('invalid_state'); // spellOf names only spells
  if (target.kind === 'use') {
    const code = useRefused(world, target, body, p.item_id, p.target_id, steps);
    if (code === 'budget_exceeded' || code === 'containment_cycle')
      return { kind: 'fault', code } as const;
    return code ? rejected(code) : p.target_id!;
  }
  const id = detailOf(world, target);
  if (p.item_id !== undefined || (p.target_id ?? id) !== id) return rejected('invalid_target');
  return world.details[id].room === world.state.containers[body] ? id : rejected('not_present');
}

// Toolbox row W23: the first accepted perform of a recipe with a tip assigns its engine-owned
// seen_tip_<key> true, and the actor reads the tip once, after the outcome's lines.
function tip(world: World, actor: CharacterId, recipe: ActionRecipe, run: Run): Run {
  if (!recipe.tip) return run;
  const fact = seenTip(world, recipe.key);
  if (value(world, actor, fact) === true) return run;
  const tipped = assigned(world, actor, run, { fact, value: true });
  return { ...tipped, lines: [...tipped.lines, { key: recipe.tip }] };
}

// The narration's participants as EntityIds; the loader checked each npc or item resolves.
function pinned(world: World, participants: RecipeNarration['participants'], body: EntityId) {
  if (!participants) return {};
  const id = (p: NarrationParticipant) =>
    p.role === 'actor' ? body : world.entityIds[refString(p.role === 'npc' ? p.npc : p.item)]!;
  return {
    participants: keys(participants).reduce<Record<string, EntityId>>(
      (o, n) => ({ ...o, [n]: id(participants[n]!) }),
      {},
    ),
  };
}

// ponytail: at most 8 draws; at bound 100 one is rejected with probability 96 / 2^32, so
// rng_budget_exhausted (which throws and discards the decision) is practically unreachable.
const DRAWS = 8;

// The check's result, its event at position 1 and the RNG after it: luck draws one uniform
// integer in [0, 100) and passes below chance; threshold draws nothing and passes when the
// body's value of the resource at admission (before costs) is at least difficulty
// (action.schema.json RecipeCheck); opposed draws nothing and passes when the actor's skill level
// or attribute is at least its rating (mechanics.md rows 5, G5 and G3).
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
  const actor = command.payload.actor_id;
  const passed =
    check.kind === 'luck'
      ? n < check.chance
      : check.kind === 'attribute_threshold'
        ? attributeValue(world, actor, check.attribute) >= check.difficulty
        : check.kind === 'opposed'
          ? opposed(world, actor, check, world.details[subject_id]?.rating ?? 0)
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
// levels: resource values as the costs and steps so far left them; lines and rng: row 29b effects.
type Run = Effected & {
  readonly facts: Readonly<Record<string, FactValue>>; // by MutationTarget text, as set so far
};
type CustomEvent = Extract<EventPayload, { type: 'custom_event' }>;
type CheckEvent = Extract<EventPayload, { type: 'check_passed' | 'check_failed' }>;
const START = { ops: [], events: [], position: 0, facts: {}, levels: {}, lines: [] };

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
    if (s.op === 'status.cure') {
      // A repeated cure of one status ends it once (cureOps reads committed state).
      const done = r.ops.some(
        (o) =>
          o.op === 'status.transition' &&
          o.body_id === subject_id &&
          refString(o.status) === refString(s.status),
      );
      return done ? r : { ...r, ops: [...r.ops, ...cureOps(world, subject_id, [s.status])] };
    }
    if (s.op === 'fact.assign')
      return assigned(world, command.payload.actor_id, r, { ...s, subject: subject_id });
    return effect(world, command, mint, body, r, s);
  };
