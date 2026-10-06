import type {
  CharacterId,
  CommandId,
  ContinuationId,
  DeltaOp,
  DialogueChoice,
  DomainEvent,
  EntityId,
  Key,
  PatrolRelation,
  QuestInstanceId,
} from '../../contracts.gen.ts';
import {
  bodyOf,
  event,
  refString,
  type ChoiceRow,
  type Mint,
  type Steps,
  type World,
} from '../../runtime/decision.ts';
import { apply } from '../../runtime/apply.ts';
import { KernelError } from '../../foundation/error.ts';
import { living } from '../death/shared.ts';
import { questOf } from '../lookups.ts';
import { resolution } from '../quest/lifecycle.ts';
import { scopeOf, value } from '../fact.ts';

import { definition, route } from './shared.ts';
type PatrolEvent = DomainEvent & {
  payload: Extract<DomainEvent['payload'], { type: 'entity_entered_room' | 'quest_resolved' }>;
};

type AcceptedCommand = {
  readonly id: CommandId;
  readonly payload: { readonly actor_id: CharacterId };
};
const transition = (
  before: PatrolRelation | null,
  after: PatrolRelation,
  writer_group = 0,
): DeltaOp => ({
  op: 'patrol.transition',
  writer_group,
  quest_instance_id: after.quest_instance_id,
  expected: before,
  value: after,
});
/** Already admitted bound choice; Start receives its own activation's quest instance. */
export function choice(
  world: World,
  command: AcceptedCommand & { payload: { continuation_id: ContinuationId; choice_id: Key } },
  row: ChoiceRow,
  activated: { type: string; instance_id: QuestInstanceId } | undefined,
  mint: Mint,
  steps: Steps,
) {
  const { continuation_id, choice_id } = command.payload;
  const option = world.cartridge.dialogues![refString(row.source)].choices[choice_id];
  const effect = option.patrol;
  if (!effect) return { ops: [] as DeltaOp[], events: [] as PatrolEvent[] };
  const quest = questOf(world, row.actor_id, effect.quest);
  const before = quest ? world.state.patrols?.[quest[0]] : undefined;
  if (effect.transition === 'start')
    return begin(
      world,
      command,
      row,
      option,
      continuation_id,
      choice_id,
      activated?.type === 'quest_activated' ? activated.instance_id : undefined,
    );
  if (!before) throw new KernelError('precondition_failed');
  if (effect.transition === 'continue') return depart(world, command, before, mint, 1, steps);
  const after: PatrolRelation =
    effect.transition === 'restart'
      ? { ...before, attempt_id: command.id, credit: [], status: 'together' }
      : { ...before, status: 'together' };
  return { ops: [transition(before, after)], events: [] as PatrolEvent[] };
}
/** Ordinary Move/Flee owns the actual transfer; only its accepted player entry can join. */
export function travel(
  world: World,
  command: AcceptedCommand,
  source_id: EntityId,
  destination_id: EntityId,
  prefix: readonly DeltaOp[],
  mint: Mint,
  steps: Steps,
) {
  const before = Object.values(world.state.patrols ?? {}).find(
    (r) => r.actor_id === command.payload.actor_id && ['together', 'awaiting'].includes(r.status),
  );
  if (!before) return { ops: [] as DeltaOp[], events: [] as PatrolEvent[], narration: [] };
  const after = follow(world, before, source_id, destination_id, steps);
  const op = transition(before, after);
  if (after.status !== 'completed')
    return { ops: [op], events: [] as PatrolEvent[], narration: [] };
  return complete(world, command, before, op, prefix, mint, steps);
}
/** Fatal reset precedes revival and remains lawful when the leader is ahead. */
export function fail(world: World, actor: CharacterId, writer_group: number): DeltaOp[] {
  const before = Object.values(world.state.patrols ?? {}).find(
    (r) => r.actor_id === actor && ['together', 'awaiting', 'paused'].includes(r.status),
  );
  return before
    ? [transition(before, { ...before, credit: [], status: 'failed' }, writer_group)]
    : [];
}

function begin(
  world: World,
  command: AcceptedCommand,
  row: ChoiceRow,
  option: DialogueChoice,
  continuation_id: ContinuationId,
  choice_id: Key,
  instance_id: QuestInstanceId | undefined,
) {
  const effect = option.patrol!;
  const settings = world.cartridge.quests![refString(effect.quest)].patrol!;
  if (!instance_id) throw new KernelError('precondition_failed');
  const after: PatrolRelation = {
    kind: 'patrol',
    actor_id: row.actor_id,
    body_id: bodyOf(world, row.actor_id)!,
    npc_id: row.roles.find((r) => r.role === effect.npc)!.entity_id,
    quest_instance_id: instance_id,
    continuation_id,
    choice_id,
    attempt_id: command.id,
    cursor: settings.initial_cursor,
    credit: [],
    status: 'together',
  };
  return { ops: [transition(null, after)], events: [] as PatrolEvent[] };
}

function depart(
  world: World,
  command: AcceptedCommand,
  before: PatrolRelation,
  mint: Mint,
  position: number,
  steps: Steps,
) {
  const edge = route(world, before, steps);
  return {
    ops: [
      {
        op: 'entity.transfer',
        writer_group: 0,
        entity_id: before.npc_id,
        source_id: edge.here,
        destination_id: edge.there,
      } as DeltaOp,
      transition(before, { ...before, cursor: edge.next, status: 'awaiting' }),
    ],
    events: [
      event(world, command, mint, position, {
        type: 'entity_entered_room',
        entity_id: before.npc_id,
        room_id: edge.there,
      }),
    ],
  };
}

function follow(
  world: World,
  before: PatrolRelation,
  source_id: EntityId,
  destination_id: EntityId,
  steps: Steps,
): PatrolRelation {
  const edge = route(world, before, steps);
  const previous = (before.cursor + edge.settings.route.length - 1) % edge.settings.route.length;
  const pendingSource = world.roomIds[refString(edge.settings.route[previous])];
  const joined =
    before.status === 'awaiting' &&
    source_id === pendingSource &&
    destination_id === edge.here &&
    world.state.containers[before.npc_id] === destination_id &&
    living(world, before.npc_id) &&
    living(world, before.body_id);
  const credited =
    joined &&
    edge.settings.checkpoints.some((r) => world.roomIds[refString(r)] === destination_id) &&
    !before.credit.includes(destination_id);
  const credit = credited ? [...before.credit, destination_id] : before.credit;
  return {
    ...before,
    credit,
    status: joined
      ? credit.length === edge.settings.required
        ? 'completed'
        : 'together'
      : 'paused',
  };
}

function complete(
  world: World,
  command: AcceptedCommand,
  before: PatrolRelation,
  op: DeltaOp,
  prefix: readonly DeltaOp[],
  mint: Mint,
  steps: Steps,
) {
  const settings = definition(world, before);
  const applied = apply(world, [...prefix, op]);
  if ('fault' in applied) throw new KernelError(applied.fault.code);
  if (
    applied.world.state.containers[before.body_id] !== applied.world.state.containers[before.npc_id]
  )
    throw new KernelError('precondition_failed');
  const quest = world.state.quests![before.quest_instance_id].quest;
  const resolved = resolution(applied.world, before.actor_id, quest, 'completed' as Key, 0, steps);
  if (typeof resolved === 'string') throw new KernelError('precondition_failed');
  const trust: DeltaOp = {
    op: 'fact.assign',
    writer_group: 0,
    fact: settings.trust_fact,
    scope: scopeOf(world, before.actor_id, settings.trust_fact),
    expected: value(world, before.actor_id, settings.trust_fact),
    value: true,
  };
  return {
    ops: [op, ...resolved.ops, trust],
    events: [event(world, command, mint, 2, resolved.payload)],
    narration: [
      {
        key: settings.narration,
        participants: { actor: before.body_id, leader: before.npc_id },
      },
    ],
  };
}
