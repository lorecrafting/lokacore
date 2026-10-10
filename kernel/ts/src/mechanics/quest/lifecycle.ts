// quest@1 (capability_registry.json; 06 §1-§5, §43; 04 §5.2): what the quest rule
// (mechanics/quest/rule.ts), the proposal (runtime/proposal.ts) and a rule that activates or resolves a quest share:
// activation, an objective's current-state evaluation, the instances an event earns, and
// resolution. A
// QuestInstance is a row of State.quests (runtime/decision.ts questOf).
import type {
  CharacterId,
  DefinitionRef,
  DeltaOp,
  ErrorCode,
  EventPayload,
  Key,
  JobId,
  QuestDefinition,
  QuestInstanceId,
  RoleBinding,
} from '../../contracts.gen.ts';
import { bodyOf, refString } from '../../runtime/decision.ts';
import { questOf } from '../lookups.ts';
import type { Mint, QuestRow, Steps, World } from '../../runtime/decision.ts';
import { holds } from '../policy.ts';
import { ready } from '../dialogue/exchange.ts';
import { cmp } from '../../foundation/validate.ts';

/** The cartridge's definition of `quest` (the loader resolves every quest reference). */
const definition = (world: World, quest: DefinitionRef): QuestDefinition =>
  world.cartridge.quests![refString(quest)];

/**
 * quest@1's activation of `actor`'s instance of `quest` (06 §2 Activation modes), active at player
 * scope, as writer group 0: its quest.activate, with a new QuestInstanceId from the decision's
 * IdSource allocator, and its quest_activated payload, for the rule that activates it
 * (accept_quest, or a dialogue choice's accept), which emits the event at its position.
 */
export function activation(mint: Mint, actor: CharacterId, quest: DefinitionRef) {
  const instance_id = mint() as QuestInstanceId;
  const scope = { kind: 'player', character_id: actor } as const;
  const op = { op: 'quest.activate', writer_group: 0, quest, scope, instance_id } as const;
  return { ops: [op], payload: { type: 'quest_activated', quest, instance_id } as const };
}

/**
 * Toolbox row W23: `ops` with started_at `at` (the logical time of the sequence's cause) on each
 * quest.activate and quest.transition of a quest whose journal declares hints; other quests' ops
 * are unchanged, so their deltas and saves keep their bytes. `prior` are the proposal's earlier
 * ops, for an instance activated in the same proposal.
 */
export function stamp(
  world: World,
  ops: readonly DeltaOp[],
  at: number,
  prior: readonly DeltaOp[],
) {
  const quests = world.cartridge.quests;
  if (!quests || !Object.values(quests).some((q) => q.journal?.hints)) return ops;
  type Activate = Extract<DeltaOp, { op: 'quest.activate' }>;
  const refOf = (id: string) =>
    world.state.quests?.[id]?.quest ??
    [...prior, ...ops].find((o): o is Activate => o.op === 'quest.activate' && o.instance_id === id)
      ?.quest;
  return ops.map((o) => {
    if (o.op !== 'quest.activate' && o.op !== 'quest.transition') return o;
    const ref = o.op === 'quest.activate' ? o.quest : refOf(o.instance_id);
    return ref && quests[refString(ref)]?.journal?.hints ? { ...o, started_at: at } : o;
  });
}

/** A bound dialogue acceptance schedules the quest's one authored absolute deadline. */
// size: allow 45, exact retirement joins bound activation and optional deadline scheduling
export function boundActivation(
  world: World,
  mint: Mint,
  actor: CharacterId,
  quest: DefinitionRef,
  bindings: readonly RoleBinding[],
) {
  const activated = activation(mint, actor, quest);
  const previous = questOf(world, actor, quest);
  const retired =
    previous && definition(world, quest).repeatable
      ? [
          {
            op: 'quest.retire' as const,
            writer_group: 0,
            instance_id: previous[0],
            quest,
            scope: previous[1].scope,
          },
        ]
      : [];
  const deadline = definition(world, quest).deadline;
  return {
    ...activated,
    ops: [
      ...retired,
      { ...activated.ops[0], bindings },
      ...(deadline
        ? [
            {
              op: 'job.schedule' as const,
              writer_group: 0,
              job_id: mint() as JobId,
              job: quest,
              due_time: deadline.at,
              quest_instance_id: activated.payload.instance_id,
              actor_id: actor,
            },
          ]
        : []),
    ],
  };
}

/**
 * Why `actor` cannot accept `quest` now, as accept_quest's admission refuses it (commands/actions.ts):
 * invalid_state when the actor already has an instance or the quest's offer, if it declares one,
 * has a policy that fails (target none). Each policy leaf it evaluates adds one to `steps`.
 */
export function acceptRefused(
  world: World,
  actor: CharacterId,
  quest: DefinitionRef,
  steps: Steps,
) {
  const d = definition(world, quest);
  const offer = d.offer;
  const prior = questOf(world, actor, quest);
  if (
    (prior && !(d.repeatable && prior[1].state === 'resolved')) ||
    (offer && !holds(world, actor, offer.policy.root, { steps }))
  )
    return 'invalid_state' as const;
  if (d.exchange) {
    const result = ready(world, actor, quest, steps);
    if (typeof result === 'string') return result;
  }
}

/**
 * True when `actor`'s current_state objective of `quest` holds now (06 §43: evaluated on the
 * state at hand, never stored); false for a post_activation_event objective, which only an
 * event meets (earned). Each policy leaf it evaluates adds one to `steps` (04 §5.4).
 */
export function holdsNow(world: World, actor: CharacterId, quest: DefinitionRef, steps: Steps) {
  const d = definition(world, quest);
  if (d.exchange) return typeof ready(world, actor, quest, steps) !== 'string';
  const o = d.objective;
  if (o.evidence === 'patrol') {
    const q = questOf(world, actor, quest);
    return !!q && world.state.patrols?.[q[0]]?.status === 'completed';
  }
  if (o.evidence === 'expedition') {
    const q = questOf(world, actor, quest);
    return !!q && world.state.expeditions?.[q[0]]?.status === 'completed';
  }
  return o.evidence === 'current_state' && holds(world, actor, o.policy.root, { steps });
}

/**
 * The instances `active` at event `e`'s causal position (04 §5.2 step 5: eligibility at emission;
 * runtime/proposal.ts join) whose post_activation_event objective `e` meets (06 §5; 04 §5.2 steps 5-6),
 * with their rows read in `world`: an item_acquired of the objective's item whose holder is the
 * body of the instance's actor. A give to someone else is not the actor's acquisition. In stable
 * semantic order (04 §5.2 step 6): by quest DefinitionRefString, then instance id, never the order
 * the rows were stored or restored in. ponytail: scans every instance per event (06 §7 allows a
 * simple scan for a private cartridge); index active instances by event type and target when
 * worlds grow.
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
 * Resolution modes), which emits the event at its position and COMPOSES quest (runtime/decision.ts).
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
  steps: Steps = { n: 0 },
): { ops: DeltaOp[]; payload: Resolved } | ErrorCode {
  const found = questOf(world, actor, quest);
  if (!found || !['active', 'objectives_complete'].includes(found[1].state)) return 'invalid_state';
  const [instance_id, { state }] = found;
  if (state === 'active' && !holdsNow(world, actor, quest, steps)) return 'quest_requirement';
  const step = { op: 'quest.transition', writer_group, instance_id } as const;
  const ops: DeltaOp[] = [
    ...(state === 'active'
      ? [{ ...step, from: 'active', to: 'objectives_complete' } as const]
      : []),
    { ...step, from: 'objectives_complete', to: 'resolved', outcome },
  ];
  return { ops, payload: { type: 'quest_resolved', quest, instance_id, outcome } };
}
