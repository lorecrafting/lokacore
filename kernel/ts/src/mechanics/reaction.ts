// reaction@1 (capability_registry.json; reaction.schema.json ReactionRule; 21 §3.4, §11; 06
// §14; 04 §5.2): the rules an event triggers and one delivery's explicit sequence. proposal.ts
// propose runs the FIFO queue, numbers the writer groups and counts the budgets.
import type {
  CharacterId,
  CommandId,
  DeltaOp,
  DomainEvent,
  EntityId,
  EventPayload,
  FactValue,
  ReactionRule,
  TextKey,
} from '../contracts.gen.ts';
import { key, same } from '../foundation/compose.ts';
import {
  accepted,
  bodyOf,
  event,
  refString,
  type Decision,
  type Mint,
  type World,
} from '../runtime/decision.ts';
import { scopeOf, value } from './fact.ts';
import { holds } from './policy.ts';
import { starts } from './scene/shared.ts';
import { activation, resolution } from './quest/lifecycle.ts';
import { questOf } from './lookups.ts';
import { cmp } from '../foundation/validate.ts';
import { suppress } from './population/shared.ts';
import { applyStatus, specOf } from './status/shared.ts';
import { grant } from './levelling/shared.ts';
import { saturate } from '../foundation/int.ts';

type On = ReactionRule['on'];
// Each trigger filter (W1; reaction.schema.json): true when the event's payload field equals it.
// A field means the same payload field in every event kind that declares it.
type Match = (w: World, want: any, p: any) => boolean;
// Null-safe: a player's entity_died carries no victim_definition.
const ref =
  (field: string): Match =>
  (_, want, p) =>
    same(want, p[field]);
const equal =
  (field: string): Match =>
  (_, want, p) =>
    want === p[field];
const FILTERS: Record<string, Match> = {
  fact: ref('fact'),
  room: (w, want, p) => w.roomIds[refString(want)] === p.room_id,
  // ponytail: the authored instance only; a created item (a harvested pelt) never matches.
  item: (w, want, p) => w.entityIds[refString(want)] === p.item_id,
  victim: ref('victim_definition'),
  custom: (_, want, p) => want === p.event.key,
  check: (_, want, p) => want === p.check.key,
  choice: equal('choice_id'),
  quest: ref('quest'),
  story_point: ref('story_point'),
  barrier: ref('barrier'),
  scene: ref('scene'),
  kind: ref('kind'),
  outcome: equal('outcome'),
  action: equal('action'),
  to: equal('to'),
  hit: equal('hit'),
};

/**
 * The cartridge's rules whose trigger `e` meets (its event type and every filter it declares),
 * in rule-key order (UTF-8 bytes; 04 §5.2 step 6), never the map's order.
 * ponytail: scans every rule per event; index them by event type when cartridges have many.
 */
export function triggered(world: World, e: DomainEvent): ReactionRule[] {
  const meets = ({ on }: ReactionRule) =>
    on.event === e.payload.type &&
    Object.entries(on).every(([f, want]) => f === 'event' || FILTERS[f]!(world, want, e.payload));
  const authored = Object.values(world.cartridge.reactions ?? {})
    .filter(meets)
    .sort((a, b) => cmp(a.key, b.key));
  // ponytail: named scene start hook; generalize when a second capability starts on events.
  return [...authored, ...starts(world, e).sort((a, b) => cmp(a.key, b.key))];
}

/**
 * `rule`'s sequence for its delivery of `cause` as writer group `group`, or undefined when its
 * `when` fails, read for `actor` on the proposal `world` at the cause's logical time (04 §5.2 step
 * 5; §5.4: events keep their visited time). Each fact.assign is at the one scope its fact allows
 * for `actor`, expecting the value the proposal and the steps before it leave. Each policy leaf
 * the `when` evaluates adds one to `steps.n`.
 */
const ACTIVATES = ['quest_resolved', 'rested'];

// size: allow 60, one ordered delivery lowers fact assignments, quest effects and suppression
export function sequence(
  world: World,
  actor: CharacterId,
  rule: ReactionRule,
  cause: DomainEvent,
  group: number,
  steps: { n: number },
  mint: Mint,
): Decision<EventPayload['type']> | undefined {
  const source = resolvedActor(world, cause, actor);
  if (!source) return { kind: 'fault', code: 'precondition_failed' };
  actor = source;
  const then = { ...world, state: { ...world.state, clock: cause.logical_time } };
  if (rule.when && !holds(then, actor, rule.when.root, { steps })) return undefined;
  const set: Record<string, FactValue> = {};
  const activated = new Set<string>();
  const applied = new Set<string>();
  const ops: DeltaOp[] = [];
  const events: DomainEvent[] = [];
  const narration: { key: TextKey }[] = [];
  let position = 0;
  let gained = 0; // one levelling write per rule, so two grants never race on one expected row
  const by = { id: cause.id as string as CommandId, payload: { actor_id: actor } };
  const emit = (payload: EventPayload) => events.push(event(then, by, mint, ++position, payload));
  for (const step of rule.apply) {
    if (step.op === 'quest.activate') {
      if (!ACTIVATES.includes(rule.on.event)) return { kind: 'fault', code: 'precondition_failed' };
      if (questOf(world, actor, step.quest) || activated.has(refString(step.quest))) continue;
      const started = activation(mint, actor, step.quest);
      activated.add(refString(step.quest));
      ops.push(...started.ops.map((op) => ({ ...op, writer_group: group })));
      emit(started.payload);
    } else if (step.op === 'quest.resolve' || step.op === 'quest.fail') {
      if (rule.on.event !== 'fact_changed') return { kind: 'fault', code: 'precondition_failed' };
      const result = terminal(world, actor, step, group, steps);
      if (!result) return { kind: 'fault', code: 'precondition_failed' };
      ops.push(...result.ops);
      if ('payload' in result) emit(result.payload);
    } else if (step.op === 'population.suppress') {
      ops.push(...suppress(world, actor, step.plan, step.duration, cause, group, mint));
    } else if (step.op === 'status.apply') {
      const body = bodyOf(then, actor);
      if (!body) return { kind: 'fault', code: 'precondition_failed' };
      if (!applies(cause, body) || applied.has(refString(step.status))) continue;
      applied.add(refString(step.status)); // one row write per status per rule
      ops.push(...applyStatus(then, body, step.status, group, mint));
      const label = specOf(then, step.status)?.narration.applied;
      if (label) narration.push({ key: label });
    } else if (step.op === 'experience.grant') {
      gained = saturate(gained + step.amount);
    } else {
      const assigned = assignment(world, actor, step, group, set);
      ops.push(assigned);
      if (assigned.expected !== step.value) position++;
    }
  }
  ops.push(...grant(then, actor, gained, group));
  return accepted(world, 'reacted', ops, events, narration.length ? narration : undefined);
}

// The payload field naming each event's subject (docs/system/mechanics.md reaction@1 table); any
// other event's subject is the actor's own body. A status applies only to its subject body: a
// scheduled NPC walking in, or a hound's death, poisons no one.
const SUBJECT: Partial<Record<On['event'], string>> = {
  entity_entered_room: 'entity_id',
  item_acquired: 'holder_id',
  custom_event: 'subject_id',
  action_completed: 'subject_id',
  check_passed: 'subject_id',
  check_failed: 'subject_id',
  entity_died: 'victim_id',
  attack_result: 'target_id',
  rested: 'body_id',
};
const applies = (cause: DomainEvent, body: EntityId) => {
  const field = SUBJECT[cause.payload.type as On['event']];
  return !field || (cause.payload as Record<string, unknown>)[field] === body;
};

function assignment(
  world: World,
  actor: CharacterId,
  step: Extract<ReactionRule['apply'][number], { op: 'fact.assign' }>,
  group: number,
  set: Record<string, FactValue>,
) {
  const scope = scopeOf(world, actor, step.fact);
  const at = key({ kind: 'fact', fact: step.fact, scope });
  const expected = Object.hasOwn(set, at) ? set[at] : value(world, actor, step.fact);
  set[at] = step.value;
  return {
    op: 'fact.assign' as const,
    writer_group: group,
    fact: step.fact,
    scope,
    expected,
    value: step.value,
  };
}

function terminal(
  world: World,
  actor: CharacterId,
  step: Extract<ReactionRule['apply'][number], { op: 'quest.resolve' | 'quest.fail' }>,
  group: number,
  steps: { n: number },
) {
  const q = questOf(world, actor, step.quest);
  if (!q || (q[1].state !== 'active' && q[1].state !== 'objectives_complete')) return;
  if (step.op === 'quest.resolve') {
    const result = resolution(world, actor, step.quest, step.outcome, group, steps);
    return typeof result === 'string' ? undefined : result;
  }
  return {
    ops: [
      {
        op: 'quest.transition' as const,
        writer_group: group,
        instance_id: q[0],
        from: q[1].state,
        to: 'failed' as const,
        outcome: step.outcome,
      },
    ],
  };
}

// A quest event's evidenced player instance owns the delivery; legacy triggers keep the root actor.
function resolvedActor(world: World, cause: DomainEvent, actor: CharacterId) {
  if (cause.payload.type !== 'quest_resolved') return actor;
  const source = world.state.quests?.[cause.payload.instance_id];
  return source &&
    source.scope.kind === 'player' &&
    source.state === 'resolved' &&
    refString(source.quest) === refString(cause.payload.quest) &&
    source.outcome === cause.payload.outcome &&
    cause.actor_id === source.scope.character_id &&
    cause.scope.kind === 'player' &&
    cause.scope.character_id === source.scope.character_id
    ? source.scope.character_id
    : undefined;
}
