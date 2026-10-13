// Toolbox row 41 (decay; docs/system/mechanics.md reaction@1): a reaction's item.move transfers
// the event's subject, when it is an item not already directly in the step's room and not
// consumed, from its current holder to that authored room, in the delivery's writer group. Any
// other subject takes nothing. No event, no line, no capacity or reach check (the room is a sink).
import type { DeltaOp, EntityId, ReactionRule } from '../../contracts.gen.ts';
import { refString, type World } from '../../runtime/decision.ts';

export function moveItem(
  world: World,
  step: Extract<ReactionRule['apply'][number], { op: 'item.move' }>,
  subject: EntityId | undefined,
  group: number,
): DeltaOp[] {
  if (!subject || world.entities[subject]?.kind !== 'item') return [];
  const [at, room] = [world.state.containers[subject], world.roomIds[refString(step.room)]];
  if (!at || !room || at === room || at === world.consumed) return [];
  return [
    {
      op: 'entity.transfer',
      writer_group: group,
      entity_id: subject,
      source_id: at,
      destination_id: room,
    },
  ];
}
