// quest@1 (capability_registry.json; 06 §1-§5, §43; 04 §5.2): what the quest rule
// (rules/quest.ts), step (world.ts) and a rule that resolves a quest share: an objective's
// current-state evaluation, the delivery of a decision's events to active instances, and
// resolution. A QuestInstance is a row of State.quests (decision.ts questOf).
import type {
  CharacterId,
  DecisionResult,
  DefinitionRef,
  DeltaOp,
  ErrorCode,
  EventPayload,
  Key,
  QuestDefinition,
  QuestInstanceId,
} from './contracts.gen.ts';
import { bodyOf, questOf, refString, type Mint, type QuestRow, type World } from './decision.ts';
import { holds } from './policy.ts';

/** The cartridge's definition of `quest` (the loader resolves every quest reference). */
export const definition = (world: World, quest: DefinitionRef): QuestDefinition =>
  world.cartridge.quests![refString(quest)];

/** A new QuestInstanceId from the decision's IdSource allocator. */
export const instanceId = (mint: Mint) => mint() as QuestInstanceId;

/**
 * True when `actor`'s current_state objective of `quest` holds now (06 §43: evaluated on the
 * state at hand, never stored); false for a post_activation_event objective, which only an
 * event meets (deliver).
 */
export function holdsNow(world: World, actor: CharacterId, quest: DefinitionRef): boolean {
  const o = definition(world, quest).objective;
  return o.evidence === 'current_state' && holds(world, actor, o.policy.root);
}

/**
 * `decision` with each post_activation_event objective its events meet moved to
 * objectives_complete (06 §5; 04 §5.2 steps 5-6): an item_acquired of the objective's item whose
 * holder is the body of the instance's actor meets an instance that was active before this
 * decision, each delivery its own writer group after the root's (0). An event before activation
 * never counts, and a give to someone else is not the actor's acquisition. ponytail: an instance
 * activated in this decision receives none of its events (only accept_quest activates, and it
 * emits nothing after quest_activated); compare positions with its quest_activated when one
 * decision can do both.
 */
export function deliver(world: World, decision: DecisionResult): DecisionResult {
  if (decision.kind !== 'accepted' || !world.cartridge.quests) return decision;
  const met = (q: QuestRow) => {
    const o = definition(world, q.quest).objective;
    const body = q.scope.kind === 'player' ? bodyOf(world, q.scope.character_id) : undefined;
    return (
      o.evidence === 'post_activation_event' &&
      decision.events.some(
        ({ payload: e }) =>
          e.type === 'item_acquired' &&
          e.item_id === world.entityIds[refString(o.item_acquired)] &&
          e.holder_id === body,
      )
    );
  };
  const done = Object.entries(world.state.quests ?? {}).filter(
    ([, q]) => q.state === 'active' && met(q),
  );
  if (!done.length) return decision;
  const ops = done.map(([instance_id], n) => ({
    op: 'quest.transition' as const,
    writer_group: n + 1,
    instance_id: instance_id as QuestInstanceId,
    from: 'active' as const,
    to: 'objectives_complete' as const,
  }));
  return { ...decision, delta: { ops: [...decision.delta.ops, ...ops] } };
}

type Resolved = Extract<EventPayload, { type: 'quest_resolved' }>;

/**
 * The explicit sequence that resolves `actor`'s instance of `quest` with `outcome` as writer
 * group `writer_group` (06 §1: active, objectives_complete, then resolved; 04 §5.3 Lifecycle
 * transition) and its quest_resolved payload, for the rule that resolves it (a choice, 06 §2
 * Resolution modes), which emits the event at its position and COMPOSES quest (decision.ts).
 * Rejected invalid_state without an open instance (none, or one resolved, failed or abandoned: a
 * resolved quest never resolves again), quest_requirement while its objective is unmet: a
 * current_state objective is evaluated now (06 §43: a historical acquisition never authorizes
 * giving an item no longer held), a post_activation_event one is met once objectives_complete.
 */
export function resolution(
  world: World,
  actor: CharacterId,
  quest: DefinitionRef,
  outcome: Key,
  writer_group: number,
): { ops: DeltaOp[]; payload: Resolved } | ErrorCode {
  const found = questOf(world, actor, quest);
  if (!found || !['active', 'objectives_complete'].includes(found[1].state)) return 'invalid_state';
  const [instance_id, { state }] = found;
  if (state === 'active' && !holdsNow(world, actor, quest)) return 'quest_requirement';
  const step = { op: 'quest.transition', writer_group, instance_id } as const;
  const ops: DeltaOp[] = [
    ...(state === 'active'
      ? [{ ...step, from: 'active', to: 'objectives_complete' } as const]
      : []),
    { ...step, from: 'objectives_complete', to: 'resolved', outcome },
  ];
  return { ops, payload: { type: 'quest_resolved', quest, instance_id, outcome } };
}
