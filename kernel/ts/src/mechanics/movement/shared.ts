import type { EntityId, RoomDefinition } from '../../contracts.gen.ts';
import { type World } from '../../runtime/decision.ts';
import { barrierState, exitOf } from '../lookups.ts';
import { level, pay, resourceRef } from '../resource.ts';
import { engaged } from '../combat/shared.ts';
import { mul } from '../../foundation/int.ts';

/**
 * Why the exit in `direction` bars the way while its barrier (barrier@1) is closed or locked;
 * undefined when it has no barrier or its barrier is open. Read-only, shared with the GameView's
 * exits (view/view.ts).
 */
export function passage(world: World, room: RoomDefinition, direction: string) {
  const barrier = exitOf(room, direction)?.barrier;
  const state = barrier && barrierState(world, barrier);
  return state === 'locked' ? 'exit_locked' : state === 'closed' ? 'exit_closed' : undefined;
}

/**
 * What a move costs `body`: the cartridge's world.movement.cost, else 1 mv where it declares the
 * pool, else nothing; undefined when the body cannot pay. Read-only, shared with the GameView's
 * exits (view/view.ts).
 */
export function fare(world: World, body: EntityId) {
  const mv = resourceRef(world, 'mv');
  const cost =
    world.cartridge.world?.movement?.cost ??
    (level(world, body, mv) === undefined ? undefined : { resource: mv, amount: 1 });
  const multiplier = engaged(world, body) ? world.cartridge.world!.combat!.flee_multiplier : 1;
  return cost ? pay(world, body, [{ ...cost, amount: mul(cost.amount, multiplier) }]) : { ops: [] };
}
