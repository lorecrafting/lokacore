// movement@1 (capability_registry.json): move through a room's exit (21 §5 Connection; 04 §5).
// A direction outside the compass is invalid_target; a compass direction without an exit here
// is not_found. Accepted: one entity.transfer of the player's body and entity_entered_room.
import {
  accepted,
  COMPASS,
  event,
  exitTo,
  has,
  refString,
  rejected,
  type Rule,
  values,
  type World,
} from '../decision.ts';
import type { DefinitionRef } from '../contracts.gen.ts';

export const decide: Rule<'movement'> = (world, command, mint) => {
  const { direction } = command.payload;
  if (!COMPASS.includes(direction)) return rejected('invalid_target');
  const here = world.state.containers[world.body];
  const to = exitTo(world.rooms[here], direction);
  const there = to && world.roomIds[refString(to)];
  if (!there) return rejected('not_found');
  const transfer = {
    op: 'entity.transfer',
    writer_group: 0,
    entity_id: world.body,
    source_id: here,
    destination_id: there,
  } as const;
  const entered = { type: 'entity_entered_room', entity_id: world.body, room_id: there } as const;
  return accepted(world, 'moved', [transfer], [event(world, command, mint, 1, entered)]);
};

/** Registered invariants of movement (protocol/invariants.json), pure checks of a world. */
export const invariants: Readonly<Record<string, (world: World) => boolean>> = {
  player_in_one_room: (world) => has(world.rooms, world.state.containers[world.body]),
  exits_resolve: (world) =>
    values(world.rooms).every((room) =>
      values<{ to: DefinitionRef }>(room.exits).every((exit) =>
        has(world.roomIds, refString(exit.to)),
      ),
    ),
};
