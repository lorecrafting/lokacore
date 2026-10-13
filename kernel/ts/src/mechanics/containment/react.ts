// Toolbox row 41 (decay; docs/system/mechanics.md reaction@1): a reaction's item.move transfers
// the event's subject, when it is an item not already directly in the step's room and not
// consumed, from its current holder (where an earlier step of the rule, `ops`, left it) to that
// authored room, in the writer group an earlier write of the advance gave the item (status/job.ts
// statusGroup), else the delivery's. Any other subject takes nothing. No event, no line, no
// capacity or reach check (the room is a sink).
import type { DeltaOp, EntityId, ReactionRule } from '../../contracts.gen.ts';
import { refString, type World } from '../../runtime/decision.ts';

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
