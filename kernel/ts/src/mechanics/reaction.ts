// size: allow 365, reaction@1 keeps its total trigger SUBJECT table beside the one delivery sequence
// reaction@1 (capability_registry.json; reaction.schema.json ReactionRule; 21 §3.4, §11; 06
// §14; 04 §5.2): the rules an event triggers and one delivery's explicit sequence. proposal.ts
// propose runs the FIFO queue, numbers the writer groups and counts the budgets.
import type {
  CharacterId,
  CommandId,
  DefinitionRef,
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
  actorOf,
  bodyOf,
  event,
  refString,
  type Decision,
  type Mint,
  type World,
} from '../runtime/decision.ts';
import { bounded, durable, npcPair, paired, subjective, targetOf, value } from './fact.ts';
import { KernelError } from '../foundation/error.ts';
import { holds } from './policy.ts';
import { starts } from './scene/shared.ts';
import { activation, resolution } from './quest/lifecycle.ts';
import { eventRooms, itemsTagged, questOf } from './lookups.ts';
import { cmp } from '../foundation/validate.ts';
import { suppress } from './population/shared.ts';
import { specOf, statusStep } from './status/shared.ts';
import { grant } from './levelling/shared.ts';
import { saturate } from '../foundation/int.ts';
import { npcsIn } from './death/shared.ts';
import { setBarrier } from './barrier/react.ts';
import { moveItem } from './containment/react.ts';
import { spawn } from './population/react.ts';

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
export const FILTERS: Record<string, Match> = {
  fact: ref('fact'),
  room: (w, want, p) => w.roomIds[refString(want)] === p.room_id,
  // ponytail: the authored instance only; a created item (a harvested pelt) never matches.
  item: (w, want, p) => w.entityIds[refString(want)] === p.item_id,
  npc: (w, want, p) => w.entityIds[refString(want)] === p.entity_id, // the entrant (W3), the hearer (G9)
  attacker: (w, want, p) => w.entityIds[refString(want)] === p.attacker_id, // loka-kgd.79
  target: (w, want, p) => w.entityIds[refString(want)] === p.target_id, // row 39
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
  status: ref('status'),
  word: equal('word'),
  loudness: equal('loudness'),
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
 * `when` fails, read for its character (the Actor column) on the proposal `world` at the cause's
 * logical time (04 §5.2 step 5; §5.4: events keep their visited time). Each fact.assign is at the
 * one scope its fact allows for that character, expecting the value the proposal and the steps
 * before it leave. Each policy leaf the `when` evaluates adds one to `steps.n`.
 */
const ACTIVATES = ['quest_resolved', 'rested', 'entity_entered_room'];
// The advance's status holders' groups (G3), and the bodies dead after the cause (`diedAfter`).
type Delivery = { holders?: Map<string, number>; dead?: ReadonlySet<EntityId> };

// size: allow 60, one ordered delivery lowers fact assignments, quest effects, suppression and spawn
export function sequence(
  world: World,
  root: CharacterId, // the root command's actor
  rule: ReactionRule,
  cause: DomainEvent,
  group: number,
  steps: { n: number },
  mint: Mint,
  { holders = new Map(), dead = new Set() }: Delivery = {},
): Decision<EventPayload['type']> | undefined {
  const [actor, npc, named] = deliveryActor(world, cause, root);
  if (!actor) return { kind: 'fault', code: 'precondition_failed' };
  const then = { ...world, state: { ...world.state, clock: cause.logical_time } };
  const about = { steps, cause, subject: subject(cause, bodyOf(then, actor)) }; // status reader 1
  if (rule.when && !holds(then, actor, rule.when.root, about)) return undefined;
  const begun = new Set<string>();
  const own = { holders, set: {}, applied: new Set<string>(), doors: new Map() }; // holders: the advance's
  const [ops, events, narration]: [DeltaOp[], DomainEvent[], { key: TextKey }[]] = [[], [], []];
  let [position, gained] = [0, 0]; // gained: one levelling write per rule (no row race)
  const by = { id: cause.id as string as CommandId, payload: { actor_id: actor } };
  const emit = (payload: EventPayload, actor_id = actor) =>
    events.push(event(then, { ...by, payload: { actor_id } }, mint, ++position, payload));
  for (const step of rule.apply) {
    if (step.op === 'quest.activate') {
      if (!ACTIVATES.includes(rule.on.event)) return { kind: 'fault', code: 'precondition_failed' };
      if (npc || questOf(world, actor, step.quest) || begun.has(refString(step.quest))) continue;
      const started = activation(mint, actor, step.quest);
      begun.add(refString(step.quest));
      ops.push(...started.ops.map((op) => ({ ...op, writer_group: group })));
      emit(started.payload);
    } else if (step.op === 'quest.resolve' || step.op === 'quest.fail') {
      const ended = ending(world, step, group, steps, emit, named);
      if (!ended) return { kind: 'fault', code: 'precondition_failed' };
      ops.push(...ended);
    } else if (step.op === 'population.suppress') {
      ops.push(...suppress(world, actor, step.plan, step.duration, cause, group, mint));
    } else if (step.op === 'status.apply' || step.op === 'status.cure') {
      const body = bodyOf(then, actor);
      if (!body) return { kind: 'fault', code: 'precondition_failed' };
      const on = holdersOf(then, step, cause, body, dead);
      const applying = statusStep(then, step, on, body, group, own, mint, emit);
      ops.push(...applying.ops);
      narration.push(...applying.narration);
    } else if (step.op === 'barrier.set') {
      ops.push(...setBarrier(then, step, cause, about.subject, group, own, emit)); // row W22
    } else if (step.op === 'item.move') {
      ops.push(...moveItem(then, step, about.subject, group, ops, holders)); // row 41
    } else if (step.op === 'population.spawn') {
      ops.push(...spawn(then, step, group, ops, mint)); // row 37a
    } else if (step.op === 'experience.grant') {
      gained = saturate(gained + step.amount);
    } else {
      const assigned = assignment(world, actor, step, group, own, cause);
      if (assigned) ops.push(assigned);
      if (assigned && assigned.expected !== assigned.value) position++;
    }
  }
  ops.push(...grant(then, actor, gained, group));
  return accepted(world, 'reacted', ops, events, narration.length ? narration : undefined);
}

/** loka-kgd.105: the bodies an `entity_died` after `cause` names; they hold none of its statuses
 * (a dead NPC takes none anyway; the player's body lives on, returned by the death). */
export const diedAfter = (events: readonly DomainEvent[], cause: DomainEvent) =>
  new Set(
    events.flatMap((e) =>
      e.payload.type === 'entity_died' && e.position > cause.position ? [e.payload.victim_id] : [],
    ),
  );

// The payload field naming each event's subject (docs/system/mechanics.md reaction@1 table), or
// 'doer': its subject, like a fact_changed without subject_id, is the delivery character's body. A status
// lands on the subject when it is a body, NPC or item (row G3): a scheduled NPC walking in is
// poisoned. A check, action or custom event's subject_id is its target; its status lands on the doer.
const SUBJECT: { [K in On['event']]: keyof Extract<EventPayload, { type: K }> | 'doer' } = {
  entity_entered_room: 'entity_id',
  item_acquired: 'holder_id',
  entity_died: 'victim_id',
  attack_result: 'target_id',
  rested: 'body_id',
  fact_changed: 'subject_id',
  status_applied: 'body_id',
  status_ticked: 'body_id',
  status_expired: 'body_id',
  spoken: 'entity_id',
  action_completed: 'doer',
  barrier_changed: 'doer',
  check_failed: 'doer',
  check_passed: 'doer',
  choice_opened: 'doer',
  choice_resolved: 'doer',
  clock_hour: 'doer',
  custom_event: 'doer',
  drank: 'doer',
  filled: 'doer',
  poured: 'doer',
  item_dropped: 'doer',
  shooed: 'doer',
  quest_activated: 'doer',
  quest_failed: 'doer',
  quest_resolved: 'doer',
  scene_ended: 'doer',
  story_point_reached: 'doer',
};
const subjectOf = (cause: DomainEvent) => {
  const field = SUBJECT[cause.payload.type as On['event']];
  return field === 'doer'
    ? undefined
    : ((cause.payload as Record<string, unknown>)[field] as EntityId | undefined);
};
const subject = (cause: DomainEvent, body?: EntityId) => subjectOf(cause) ?? body;
// The characters holding `quest` open (player scope, active or objectives_complete), in order.
const questHolders = (world: World, quest: DefinitionRef) =>
  Object.values(world.state.quests ?? {})
    .flatMap((q) =>
      key(q.quest) === key(quest) &&
      q.scope.kind === 'player' &&
      (q.state === 'active' || q.state === 'objectives_complete')
        ? [q.scope.character_id]
        : [],
    )
    .sort();

// A status step's holders (row G3): the step's named item's or (row 42) NPC's instance or (reader 9) room, (row W21)
// every living NPC or (row W22, with tag) every item so tagged lying in the event's room, else the
// event's subject; none a body dead after the cause (`diedAfter`) takes.
function holdersOf(
  world: World,
  step: StatusStep,
  cause: DomainEvent,
  body: EntityId,
  dead: ReadonlySet<EntityId>,
) {
  const apply = step.op === 'status.apply' ? step : undefined;
  const named = apply?.item ?? apply?.npc;
  const one = apply?.room
    ? world.roomIds[refString(apply.room)]
    : named
      ? world.entityIds[refString(named)]
      : subject(cause, body);
  const rooms = apply?.co_present && eventRooms(world, cause, one);
  // loka-kgd.105: but a permanent status (row W8) outlives the death, as on the body it returns.
  const lasting = specOf(world, step.status)?.duration === 'permanent';
  if (!rooms) return one && dead.has(one) && !lasting ? [] : [one];
  return apply.tag ? itemsTagged(world, rooms, apply.tag) : npcsIn(world, rooms);
}
type StatusStep = Extract<ReactionRule['apply'][number], { op: 'status.apply' | 'status.cure' }>;
// A fact.assign, or (row 15) a fact.adjust lowered to one at the bounded sum (nothing when the
// fact cannot be adjusted); an entity or pair fact (row W2) at the step's named NPC's or item's
// instance, else at the event's subject when that is an NPC, item or detail (never the body
// fallback); with no such subject the step writes nothing. An npc_pair fact (row FD4) writes at that
// subject toward the step's `with` NPC, only when both are distinct NPCs. A row an earlier reaction of this
// advance wrote keeps that write's writer group, so the writes compose in order (loka-j2mo).
function assignment(
  world: World,
  actor: CharacterId,
  step: Extract<ReactionRule['apply'][number], { op: 'fact.assign' | 'fact.adjust' }>,
  group: number,
  { set, holders }: { set: Record<string, FactValue>; holders: Map<string, number> },
  cause: DomainEvent,
) {
  const named = step.npc ?? step.item;
  const who = (named ? world.entityIds[refString(named)] : subject(cause)) || undefined;
  const thing = who !== undefined && (world.entities[who] || world.details[who]);
  if (subjective(world, step.fact) && !thing) return undefined;
  if (durable(world, step.fact)) throw new KernelError('precondition_failed');
  const partner = step.with && world.entityIds[refString(step.with)];
  if (paired(world, step.fact) && !npcPair(world, who, partner)) return undefined;
  const { kind: _, ...target } = targetOf(world, actor, step.fact, who, partner);
  const at = key({ kind: 'fact', ...target });
  const expected = Object.hasOwn(set, at) ? set[at] : value(world, actor, step.fact, who, partner);
  const next =
    step.op === 'fact.adjust' ? bounded(world, step.fact, expected, step.amount) : step.value;
  if (next === undefined) return undefined;
  set[at] = next;
  const writer_group = holders.get(at) ?? group;
  holders.set(at, writer_group);
  return { op: 'fact.assign' as const, writer_group, ...target, expected, value: next };
}

// quest.resolve/fail for the trigger's own character, else each holder; undefined on a fault.
function ending(
  world: World,
  step: Extract<ReactionRule['apply'][number], { op: 'quest.resolve' | 'quest.fail' }>,
  group: number,
  steps: { n: number },
  emit: (payload: EventPayload, actor_id: CharacterId) => void,
  own: CharacterId | undefined,
) {
  const ops: DeltaOp[] = [];
  for (const holder of questHolders(world, step.quest).filter((h) => !own || h === own)) {
    const result = terminal(world, holder, step, group, steps);
    if (!result) return undefined;
    ops.push(...result.ops);
    if ('payload' in result) emit(result.payload, holder);
  }
  return ops;
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
/** loka-kgd.150.2: actor (the subject's character, else the doer), whether a non-player subject
 * blocks activation, and the trigger's own character (Attribution). ponytail: the root actor
 * stands in while proposal-made events carry no actor_id; stamping them re-pins fixtures (R14). */
function deliveryActor(world: World, cause: DomainEvent, root: CharacterId) {
  const named = subjectOf(cause);
  const character = named && actorOf(world, named);
  const actor = resolvedActor(world, cause, character ?? cause.actor_id ?? root);
  const player = (s: DomainEvent['scope']) => (s.kind === 'player' ? s.character_id : undefined);
  const doer = cause.payload.type === 'fact_changed' ? player(cause.scope) : cause.actor_id;
  const own = named ? character : cause.payload.type === 'quest_resolved' ? actor : doer;
  return [actor, Boolean(named && !character), own] as const;
}

// A quest event's evidenced owner.
function resolvedActor(world: World, cause: DomainEvent, actor: CharacterId | undefined) {
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
