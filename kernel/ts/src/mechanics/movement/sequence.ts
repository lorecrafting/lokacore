import type { CharacterId, CommandId, Key } from '../../contracts.gen.ts';
import {
  accepted,
  bodyOf,
  COMPASS,
  event,
  refString,
  rejected,
  type Mint,
  type World,
} from '../../runtime/decision.ts';
import { exitTo } from '../lookups.ts';
import { standing } from '../position/shared.ts';
import { closeEncounter } from '../combat/shared.ts';
import { fare, passage } from './shared.ts';

/** Shared ordinary/escape movement: admission, one payment, one transfer and closure. */
type MoveCommand = {
  readonly id: CommandId;
  readonly payload: { readonly actor_id: CharacterId; readonly direction: Key };
};
export function moveSequence(world: World, command: MoveCommand, mint: Mint, outcome: string) {
  const plan = movementPlan(world, command.payload.actor_id, command.payload.direction);
  if (typeof plan === 'string') return rejected(plan);
  const { body, here, there, paid } = plan;
  const transfer = {
    op: 'entity.transfer',
    writer_group: 0,
    entity_id: body,
    source_id: here,
    destination_id: there,
  } as const;
  return accepted(
    world,
    outcome,
    [...paid.ops, transfer, ...closeEncounter(world, body)],
    [
      event(world, command, mint, 1, {
        type: 'entity_entered_room',
        entity_id: body,
        room_id: there,
      }),
    ],
  );
}

/** Read-only ordinary movement checks, reused before random escape selection. */
export function movementPlan(world: World, actor_id: CharacterId, direction: Key) {
  if (!COMPASS.includes(direction)) return 'invalid_target' as const;
  const body = bodyOf(world, actor_id);
  if (!body) return 'not_found' as const;
  const here = world.state.containers[body];
  const to = exitTo(world.rooms[here], direction);
  const there = to && world.roomIds[refString(to)];
  if (!there) return 'not_found' as const;
  const barred = passage(world, world.rooms[here], direction);
  if (barred) return barred;
  if (!standing(world, actor_id)) return 'invalid_state' as const;
  const paid = fare(world, body);
  if (!paid) return 'insufficient_resource' as const;
  return { body, here, there, paid };
}
