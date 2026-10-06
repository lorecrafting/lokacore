// reaction@1 (capability_registry.json; reaction.schema.json ReactionRule; 21 §3.4, §11; 06
// §14; 04 §5.2): the rules an event triggers and one delivery's explicit sequence. proposal.ts
// propose runs the FIFO queue, numbers the writer groups and counts the budgets.
import type {
  CharacterId,
  CommandId,
  DeltaOp,
  DomainEvent,
  EventPayload,
  FactValue,
  ReactionRule,
} from '../contracts.gen.ts';
import { key } from '../foundation/compose.ts';
import {
  accepted,
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

type Payload<T> = Extract<EventPayload, { type: T }>;

/**
 * The cartridge's rules whose trigger `e` meets (its event type, and the fact that changed or the
 * room entered), in rule-key order (UTF-8 bytes; 04 §5.2 step 6), never the map's order.
 * ponytail: scans every rule per event; index them by event type when cartridges have many.
 */
export function triggered(world: World, e: DomainEvent): ReactionRule[] {
  const meets = ({ on }: ReactionRule) =>
    on.event === e.payload.type &&
    (on.event === 'fact_changed'
      ? key(on.fact) === key((e.payload as Payload<'fact_changed'>).fact)
      : on.event === 'quest_resolved'
        ? refString(on.quest) === refString((e.payload as Payload<'quest_resolved'>).quest) &&
          on.outcome === (e.payload as Payload<'quest_resolved'>).outcome
        : world.roomIds[refString(on.room)] ===
          (e.payload as Payload<'entity_entered_room'>).room_id);
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
  const ops: DeltaOp[] = [];
  const events: DomainEvent[] = [];
  let position = 0;
  for (const step of rule.apply) {
    if (step.op === 'quest.activate') {
      if (!ACTIVATES.includes(rule.on.event)) return { kind: 'fault', code: 'precondition_failed' };
      if (questOf(world, actor, step.quest) || activated.has(refString(step.quest))) continue;
      const started = activation(mint, actor, step.quest);
      activated.add(refString(step.quest));
      ops.push(...started.ops.map((op) => ({ ...op, writer_group: group })));
      events.push(
        event(
          then,
          { id: cause.id as string as CommandId, payload: { actor_id: actor } },
          mint,
          ++position,
          started.payload,
        ),
      );
    } else if (step.op === 'quest.resolve' || step.op === 'quest.fail') {
      if (rule.on.event !== 'fact_changed') return { kind: 'fault', code: 'precondition_failed' };
      const result = terminal(world, actor, step, group, steps);
      if (!result) return { kind: 'fault', code: 'precondition_failed' };
      ops.push(...result.ops);
      if ('payload' in result)
        events.push(
          event(
            then,
            { id: cause.id as string as CommandId, payload: { actor_id: actor } },
            mint,
            ++position,
            result.payload,
          ),
        );
    } else if (step.op === 'population.suppress') {
      ops.push(...suppress(world, actor, step.plan, step.duration, cause, group, mint));
    } else {
      const assigned = assignment(world, actor, step, group, set);
      ops.push(assigned);
      if (assigned.expected !== step.value) position++;
    }
  }
  return accepted(world, 'reacted', ops, events);
}

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
