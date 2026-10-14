// size: allow 350, reaction@1's triggers, its one ordered delivery and row FD1's delayed job run
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
  JobId,
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
import { bounded, durable, subjective, targetOf, value } from './fact.ts';
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
 * `when` fails, read for `actor` on the proposal `world` at the cause's logical time (04 §5.2 step
 * 5; §5.4: events keep their visited time). Each fact.assign is at the one scope its fact allows
 * for `actor`, expecting the value the proposal and the steps before it leave. Each policy leaf
 * the `when` evaluates adds one to `steps.n`.
 */
const ACTIVATES = ['quest_resolved', 'rested'];
// The advance's status holders' groups (G3), and the bodies dead after the cause (`diedAfter`).
// fired: a delayed rule's job run (toolbox row FD1), which runs the steps instead of scheduling them.
type Delivery = { holders?: Map<string, number>; dead?: ReadonlySet<EntityId>; fired?: boolean };

// size: allow 60, one ordered delivery lowers fact assignments, quest effects, suppression and spawn
export function sequence(
  world: World,
  listener: CharacterId,
  rule: ReactionRule,
  cause: DomainEvent,
  group: number,
  steps: { n: number },
  mint: Mint,
  { holders = new Map(), dead = new Set(), fired = false }: Delivery = {},
): Decision<EventPayload['type']> | undefined {
  const actor = resolvedActor(world, cause, listener); // a quest event's evidenced owner
  if (!actor) return { kind: 'fault', code: 'precondition_failed' };
  const then = { ...world, state: { ...world.state, clock: cause.logical_time } };
  const about = { steps, cause, subject: subject(cause, bodyOf(then, actor)) }; // status reader 1
  if (rule.when && !holds(then, actor, rule.when.root, about)) return undefined;
  if (rule.after && !fired) return delayed(world, actor, rule, cause, group, mint);
  const own = { holders, set: {}, applied: new Set<string>(), doors: new Map(), quests: new Set() };
  const [ops, events, narration]: [DeltaOp[], DomainEvent[], { key: TextKey }[]] = [[], [], []];
  let [position, gained] = [0, 0]; // gained: one levelling write per rule (no row race)
  const by = { id: cause.id as string as CommandId, payload: { actor_id: actor } };
  const emit = (payload: EventPayload) => events.push(event(then, by, mint, ++position, payload));
  for (const step of rule.apply) {
    if (step.op === 'quest.activate') {
      if (!ACTIVATES.includes(rule.on.event)) return { kind: 'fault', code: 'precondition_failed' };
      if (questOf(world, actor, step.quest) || own.quests.has(refString(step.quest))) continue;
      const started = activation(mint, actor, step.quest);
      own.quests.add(refString(step.quest));
      ops.push(...started.ops.map((op) => ({ ...op, writer_group: group })));
      emit(started.payload);
    } else if (step.op === 'quest.resolve' || step.op === 'quest.fail') {
      const result = rule.on.event === 'fact_changed' && terminal(world, actor, step, group, steps);
      if (!result) return { kind: 'fault', code: 'precondition_failed' };
      ops.push(...result.ops);
      if ('payload' in result) emit(result.payload);
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

// The payload field naming each event's subject (docs/system/mechanics.md reaction@1 table); any
// other event's subject, or a fact_changed without subject_id, is the actor's own body. A status
// lands on the subject when it is a body, NPC or item (row G3): a scheduled NPC walking in is
// poisoned. A check, action or custom event's subject_id is its target; its status lands on the doer.
const SUBJECT: Partial<Record<On['event'], string>> = {
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
};
const subject = (cause: DomainEvent, body?: EntityId) => {
  const field = SUBJECT[cause.payload.type as On['event']];
  const id = field
    ? ((cause.payload as Record<string, unknown>)[field] as EntityId | undefined)
    : undefined;
  return id ?? body;
};

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

// A fact.assign, (row FD1) a fact.stamp of the delivery's time, or (row 15) a fact.adjust lowered to one at the bounded sum (nothing when the
// fact cannot be adjusted); an entity or pair fact (row W2) at the step's named NPC's or item's
// instance, else at the event's subject when that is an NPC, item or detail (never the body
// fallback); with no such subject the step writes nothing. A row an earlier reaction of this
// advance wrote keeps that write's writer group, so the writes compose in order (loka-j2mo).
function assignment(
  world: World,
  actor: CharacterId,
  step: Extract<
    ReactionRule['apply'][number],
    { op: 'fact.assign' | 'fact.adjust' | 'fact.stamp' }
  >,
  group: number,
  { set, holders }: { set: Record<string, FactValue>; holders: Map<string, number> },
  cause: DomainEvent,
) {
  const named = step.npc ?? step.item;
  const who = (named ? world.entityIds[refString(named)] : subject(cause)) || undefined;
  const thing = who !== undefined && (world.entities[who] || world.details[who]);
  if (subjective(world, step.fact) && !thing) return undefined;
  if (durable(world, step.fact)) throw new KernelError('precondition_failed');
  const { kind: _, ...target } = targetOf(world, actor, step.fact, who);
  const at = key({ kind: 'fact', ...target });
  const expected = Object.hasOwn(set, at) ? set[at] : value(world, actor, step.fact, who);
  const next =
    step.op === 'fact.adjust'
      ? bounded(world, step.fact, expected, step.amount)
      : step.op === 'fact.stamp'
        ? cause.logical_time // row FD1: the delivery's time
        : step.value;
  if (next === undefined) return undefined;
  set[at] = next;
  const writer_group = holders.get(at) ?? group;
  holders.set(at, writer_group);
  return { op: 'fact.assign' as const, writer_group, ...target, expected, value: next };
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

// Row FD1: a rule with `after` writes one reaction job for its actor in place of its steps.
function delayed(
  world: World,
  actor: CharacterId,
  rule: ReactionRule,
  cause: DomainEvent,
  group: number,
  mint: Mint,
): Decision<never> {
  const { id, version } = world.cartridge.manifest;
  const job = { cartridge_id: id, cartridge_version: version, kind: 'reaction', key: rule.key };
  // ponytail: a delay ending inside this proposal's advance arrives 1 s after it (the composer
  // refuses a job due inside it, compose_job.ts nonfuture_job); never early, possibly late.
  const due_time = Math.max(saturate(cause.logical_time + rule.after!), world.state.clock + 1);
  const op = { op: 'job.schedule', writer_group: group, job_id: mint() as JobId, job, due_time };
  return accepted(world, 'reacted', [{ ...op, actor_id: actor } as DeltaOp], []);
}

/** Row FD1: a reaction job's run_job. It completes; then its rule runs for the stored actor at the
 * due time, as a delivery whose event has no subject. A rule gone from the cartridge, or a `when`
 * that fails then, writes only the completion (a fact guard cancels a delayed reaction). */
export function runDelayed(
  world: World,
  command: { id: CommandId },
  job_id: JobId,
  row: { job: DefinitionRef; actor_id?: CharacterId; due_time: number },
  mint: Mint,
  steps: { n: number },
): Decision<never> {
  const done: DeltaOp = { op: 'job.complete', writer_group: 0, job_id };
  const rule = world.cartridge.reactions?.[refString(row.job)];
  // A stand-in cause: no subject field (custom_event names none), the job's time.
  const cause = { id: command.id, logical_time: row.due_time, position: 0 };
  const stand = { ...cause, payload: { type: 'custom_event' } } as unknown as DomainEvent;
  const ran = rule && sequence(world, row.actor_id!, rule, stand, 0, steps, mint, { fired: true });
  if (ran?.kind === 'fault' || ran?.kind === 'rejected') return ran;
  const [ops, events] = ran ? [ran.delta.ops, ran.events] : [[], []];
  return accepted(world, 'job_ran', [done, ...ops], events as never[], ran?.narration);
}
