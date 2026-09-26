// movement@1 (capability_registry.json): move through a room's exit (21 §5 Connection; 04 §5).
// A direction outside the compass is invalid_target; a compass direction without an exit here
// is not_found, and one through a closed or locked barrier (barrier@1) exit_closed or exit_locked
// (passage). In a cartridge that declares the mv pool (resource@1; 00 §4 amendment), a move
// costs the body 1 mv, and one it cannot pay is insufficient_resource ("You are too exhausted.").
// Accepted: that resource.adjust (none without the pool), one entity.transfer of the actor's
// body and entity_entered_room; no resource event. ponytail: 1 mv per room; terrain costs (the
// average of the two rooms' terrain, 00 §4.1) replace the 1 in R8.
import {
  accepted,
  barrierState,
  bodyOf,
  COMPASS,
  event,
  exitOf,
  exitTo,
  has,
  refString,
  rejected,
  type Rule,
  values,
  type World,
} from '../decision.ts';
import type { DefinitionRef, EntityId, RoomDefinition } from '../contracts.gen.ts';
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
  const barred = passage(world, world.rooms[here], direction);
  if (barred) return rejected(barred);
  const paid = fare(world, body);
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

/**
 * Why the exit in `direction` bars the way while its barrier (barrier@1) is closed or locked;
 * undefined when it has no barrier or its barrier is open. Read-only, shared with the GameView's
 * exits (view.ts).
 */
export function passage(world: World, room: RoomDefinition, direction: string) {
  const barrier = exitOf(room, direction)?.barrier;
  const state = barrier && barrierState(world, barrier);
  return state === 'locked' ? 'exit_locked' : state === 'closed' ? 'exit_closed' : undefined;
}

/**
 * What a move costs `body`: 1 mv where the cartridge declares the pool, else nothing; undefined
 * when the body cannot pay. Read-only, shared with the GameView's exits (view.ts).
 */
export function fare(world: World, body: EntityId) {
  const mv = resourceRef(world, 'mv');
  return level(world, body, mv) === undefined ? { ops: [] } : pay(world, body, [MV(mv)]);
}

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
