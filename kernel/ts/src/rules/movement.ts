// movement@1 (capability_registry.json): move through a room's exit (21 §5 Connection; 04 §5).
// A direction outside the compass is invalid_target; a compass direction without an exit here
// is not_found. In a cartridge that declares the mv pool (resource@1; 00 §4 amendment), a move
// costs the body 1 mv, and one it cannot pay is insufficient_resource ("You are too exhausted.").
// Accepted: that resource.adjust (none without the pool), one entity.transfer of the actor's
// body and entity_entered_room; no resource event. ponytail: 1 mv per room; terrain costs (the
// average of the two rooms' terrain, 00 §4.1) replace the 1 in R8.
import {
  accepted,
  bodyOf,
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
import { level, pay, resourceRef } from '../resource.ts';

export const decide: Rule<'movement'> = (world, command, mint) => {
  const { direction } = command.payload;
  if (!COMPASS.includes(direction)) return rejected('invalid_target');
  const body = bodyOf(world, command.payload.actor_id);
  if (!body) return rejected('not_found');
  const here = world.state.containers[body];
  const to = exitTo(world.rooms[here], direction);
  const there = to && world.roomIds[refString(to)];
  if (!there) return rejected('not_found');
  const mv = resourceRef(world, 'mv');
  const paid = level(world, body, mv) === undefined ? { ops: [] } : pay(world, body, [MV(mv)]);
  if (!paid) return rejected('insufficient_resource');
  const transfer = {
    op: 'entity.transfer',
    writer_group: 0,
    entity_id: body,
    source_id: here,
    destination_id: there,
  } as const;
  const entered = { type: 'entity_entered_room', entity_id: body, room_id: there } as const;
  const ops = [...paid.ops, transfer];
  return accepted(world, 'moved', ops, [event(world, command, mint, 1, entered)]);
};

const MV = (resource: DefinitionRef) => ({ resource, amount: 1 });

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
