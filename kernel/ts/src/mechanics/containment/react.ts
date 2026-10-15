// Toolbox row 41 (decay; docs/system/mechanics.md reaction@1): a reaction's item.move transfers
// the event's subject, when it is an item not already directly in the step's room and not
// consumed, from its current holder (where an earlier step of the rule, `ops`, left it) to that
// authored room, in the writer group an earlier write of the advance gave the item (status/job.ts
// statusGroup), else the delivery's. Any other subject takes nothing. No event, no line, no
// capacity or reach check (the room is a sink).
import type {
  CharacterId,
  DeltaOp,
  DomainEvent,
  EntityId,
  EventPayload,
  ReactionRule,
} from '../../contracts.gen.ts';
import { refString, type World } from '../../runtime/decision.ts';
import { engaged } from '../combat/shared.ts';
import { living } from '../death/shared.ts';
import { eventRooms } from '../lookups.ts';
import { running } from '../scene/shared.ts';

export function moveItem(
  world: World,
  step: Extract<ReactionRule['apply'][number], { op: 'item.move' }>,
  subject: EntityId | undefined,
  group: number,
  ops: readonly DeltaOp[],
  holders: Map<string, number>,
): DeltaOp[] {
  if (!subject || world.entities[subject]?.kind !== 'item') return [];
  const moved = ops.filter((o) => o.op === 'entity.transfer' && o.entity_id === subject).pop();
  const at =
    moved?.op === 'entity.transfer' ? moved.destination_id : world.state.containers[subject];
  const room = world.roomIds[refString(step.room)];
  if (!at || !room || at === room || at === world.consumed) return [];
  const writer_group = holders.get(subject) ?? group; // an earlier write of the item in the advance
  holders.set(subject, writer_group); // and a later replenish move of it joins this one
  return [
    {
      op: 'entity.transfer',
      writer_group,
      entity_id: subject,
      source_id: at,
      destination_id: room,
    },
  ];
}

type Move = Extract<ReactionRule['apply'][number], { op: 'item.move' | 'npc.move' }>;
// A reaction's item.move (row 41) or npc.move (row FD5) step.
export const moved = (
  world: World,
  step: Move,
  actor: CharacterId,
  { cause, subject }: { cause: DomainEvent; subject?: EntityId },
  group: number,
  ops: readonly DeltaOp[],
  holders: Map<string, number>,
  emit: (payload: EventPayload) => void,
) =>
  step.op === 'item.move'
    ? moveItem(world, step, subject, group, ops, holders)
    : running(world, actor)
      ? []
      : moveNpc(world, step, cause, subject, group, ops, holders, emit);

// Row FD5 (loka-kgd.22): a reaction's npc.move jumps the step's named NPC, else the event's
// subject when it is an NPC, living and unengaged, to the step's room, else the event's room, as a
// schedule move does (no exit, passage or lock), from where an earlier step left it, in the writer
// group of an earlier write of the NPC in the advance, else the delivery's, and emits its
// entity_entered_room at the cause's time; nothing when it is already there, no room resolves or
// (moved) the delivery's character is in a running scene.
function moveNpc(
  world: World,
  step: Extract<Move, { op: 'npc.move' }>,
  cause: DomainEvent,
  subject: EntityId | undefined,
  group: number,
  ops: readonly DeltaOp[],
  holders: Map<string, number>,
  emit: (payload: EventPayload) => void,
): DeltaOp[] {
  const npc = step.npc ? world.entityIds[refString(step.npc)] : subject;
  const [room] = step.room ? [world.roomIds[refString(step.room)]] : eventRooms(world, cause, npc);
  if (!npc || !room || world.entities[npc]?.kind !== 'npc') return [];
  if (!living(world, npc) || engaged(world, npc)) return [];
  const moved = ops.filter((o) => o.op === 'entity.transfer' && o.entity_id === npc).pop();
  const at = moved?.op === 'entity.transfer' ? moved.destination_id : world.state.containers[npc];
  if (!at || at === room) return [];
  const writer_group = holders.get(npc) ?? group;
  holders.set(npc, writer_group);
  const destination_id = room as EntityId;
  emit({ type: 'entity_entered_room', entity_id: npc, room_id: destination_id });
  return [{ op: 'entity.transfer', writer_group, entity_id: npc, source_id: at, destination_id }];
}
