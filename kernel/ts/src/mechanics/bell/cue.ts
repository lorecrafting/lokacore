import type { CharacterId, CommandId, DomainEvent, EntityId } from '../../contracts.gen.ts';
import { refString, type World } from '../../runtime/decision.ts';

/** Read-only projection of one accepted bell fact event into an observer's original room. */
export function bellCue(
  world: World,
  event: DomainEvent,
  command_id: CommandId,
  observer_id: CharacterId,
  room_id: EntityId,
) {
  const cue = world.cartridge.world?.bell_cue;
  if (
    !cue ||
    (event.causation_id as string) !== command_id ||
    event.payload.type !== 'fact_changed' ||
    event.payload.new !== true ||
    refString(event.payload.fact) !== refString(cue.fact) ||
    !cue.rooms.some((r) => world.roomIds[refString(r)] === room_id)
  )
    return;
  return {
    source_event_id: event.id,
    command_id,
    actor_id: event.actor_id,
    observer_id,
    room_id,
    logical_time: event.logical_time,
    key: cue.text,
  };
}
