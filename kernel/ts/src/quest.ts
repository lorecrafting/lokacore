// quest@1 (capability_registry.json; 06 §1-§5, §43; 04 §5.2): what the quest rule
// (rules/quest.ts), the proposal (proposal.ts) and a rule that resolves a quest share: an
// objective's current-state evaluation, the instances an event earns, and resolution. A
// QuestInstance is a row of State.quests (decision.ts questOf).
import type {
  CharacterId,
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
import { cmp } from './validate.ts';

/** The cartridge's definition of `quest` (the loader resolves every quest reference). */
const definition = (world: World, quest: DefinitionRef): QuestDefinition =>
  world.cartridge.quests![refString(quest)];

/** A new QuestInstanceId from the decision's IdSource allocator. */
export const instanceId = (mint: Mint) => mint() as QuestInstanceId;

/**
 * True when `actor`'s current_state objective of `quest` holds now (06 §43: evaluated on the
 * state at hand, never stored); false for a post_activation_event objective, which only an
 * event meets (earned).
 */
export function holdsNow(world: World, actor: CharacterId, quest: DefinitionRef): boolean {
  const o = definition(world, quest).objective;
  return o.evidence === 'current_state' && holds(world, actor, o.policy.root);
}

/**
 * The instances `active` at event `e`'s causal position (04 §5.2 step 5: eligibility at emission;
 * proposal.ts join) whose post_activation_event objective `e` meets (06 §5; 04 §5.2 steps 5-6), with
 * their rows read in `world`: an item_acquired of the objective's item whose holder is the body of
 * the instance's actor. A give to someone else is not the actor's acquisition. In stable semantic
 * order (04 §5.2 step 6): by quest DefinitionRefString, then instance id, never the order the rows
 * were stored or restored in. ponytail: scans every instance per event (06 §7 allows a simple scan
 * for a private cartridge); index active instances by event type and target when worlds grow.
 */
export function earned(
  world: World,
  e: EventPayload,
  active: (id: string) => boolean,
): QuestInstanceId[] {
  if (e.type !== 'item_acquired' || !world.cartridge.quests) return [];
  const met = (q: QuestRow) => {
    const o = definition(world, q.quest).objective;
    const body = q.scope.kind === 'player' ? bodyOf(world, q.scope.character_id) : undefined;
    return (
      o.evidence === 'post_activation_event' &&
      e.item_id === world.entityIds[refString(o.item_acquired)] &&
      e.holder_id === body
    );
  };
  const order = ([i, q]: [string, QuestRow]) => `${refString(q.quest)} ${i}`;
  return Object.entries(world.state.quests ?? {})
    .filter(([i, q]) => active(i) && met(q))
    .sort((a, b) => cmp(order(a), order(b)))
    .map(([i]) => i as QuestInstanceId);
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
 * The resolving rule checks custody and presence first (slice D): a strict objective stays met
 * after the item is dropped.
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
