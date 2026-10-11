import type { CharacterId, EntityId, RoomDefinition, Tag } from '../../contracts.gen.ts';
import { type World } from '../../runtime/decision.ts';
import { barrierState, exitOf } from '../lookups.ts';
import { bodyOf, refString, type Steps } from '../../runtime/decision.ts';
import { value } from '../fact.ts';
import { living } from '../death/shared.ts';
import { LIMITS } from '../../contracts.gen.ts';
import { KernelError } from '../../foundation/error.ts';
import { adjust, level, pay, resourceRef, resourceSpec, type Levels } from '../resource.ts';
import { held } from '../policy.ts';
import { engaged } from '../combat/shared.ts';
import { mul, saturate } from '../../foundation/int.ts';
import { statusMovement } from '../status/shared.ts';

/**
 * Why the exit in `direction` bars the way while its barrier (barrier@1) is closed or locked;
 * undefined when it has no barrier or its barrier is open. Read-only, shared with the GameView's
 * exits (view/view.ts).
 */
export function passage(
  world: World,
  room: RoomDefinition,
  direction: string,
  actor?: CharacterId,
  steps: Steps = { n: 0 },
) {
  const exit = exitOf(room, direction);
  const barrier = exit?.barrier;
  const state = barrier && barrierState(world, barrier);
  if (state === 'locked') return 'exit_locked';
  if (state === 'closed') return 'exit_closed';
  const gate = exit?.corpse_ingress;
  if (!gate || !actor || value(world, actor, gate.fact) !== gate.equals) return undefined;
  const body = bodyOf(world, actor);
  const there = world.roomIds[refString(exit.to)];
  if (body && living(world, body)) {
    for (const [id, identity] of Object.entries(world.state.created ?? {})) {
      if (++steps.n > LIMITS.query_steps) throw new KernelError('budget_exceeded');
      if (
        identity.origin.kind !== 'death' ||
        identity.origin.owner_id !== actor ||
        identity.origin.victim_id !== body ||
        world.state.containers[id] !== there ||
        refString(identity.definition) !== refString(world.cartridge.world!.death!.player_corpse)
      )
        continue;
      for (const [root, holder] of Object.entries(world.state.containers)) {
        if (++steps.n > LIMITS.query_steps) throw new KernelError('budget_exceeded');
        if (holder === id && world.entities[root]?.kind === 'item') return undefined;
      }
    }
  }
  return 'exit_closed';
}

/**
 * The fall of a climb (toolbox row 30) when `body` crosses the exit in `direction` without the
 * climb's item: its HP loss after `levels`, stopping at 1 or the pool's minimum (a fall never
 * kills), and its narration key. Undefined when the exit is no climb or the body holds the item.
 */
export function fall(
  world: World,
  room: RoomDefinition,
  direction: string,
  body: EntityId,
  levels: Levels,
) {
  const climb = exitOf(room, direction)?.climb;
  if (!climb || held(world, world.entityIds[refString(climb.item)], body)) return undefined;
  const hp = resourceRef(world, 'hp');
  const { op } = adjust(world, body, hp, -climb.damage, levels);
  const to = Math.max(op.to, 1, resourceSpec(world, body, hp).minimum);
  return { ops: to < op.from ? [{ ...op, to }] : [], narration: { key: climb.fell } };
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
  if (!cost) return { ops: [] };
  // Status reader 7: each active status's cost_percent in turn, rounded down and saturated (a
  // fare past the pool is refused by pay, never an overflow fault); a fare of 0 writes nothing.
  const amount = statusMovement(world, body).reduce(
    (a, m) => (m.cost_percent === undefined ? a : saturate(Math.floor((a * m.cost_percent) / 100))),
    mul(cost.amount, multiplier),
  );
  return amount ? pay(world, body, [{ ...cost, amount }]) : { ops: [] };
}

/** Status reader 7: the room tags that bar a move into the room (status `movement.passes`). */
export const TERRAIN: readonly Tag[] = ['air', 'chasm', 'water'];

/**
 * Status reader 7: whether `body` may enter room `there`: each terrain tag of the room is one its
 * active statuses pass. Read-only, in movementPlan (so step, flee and the GameView's exits agree).
 */
export function crossable(world: World, body: EntityId, there: EntityId) {
  const terrain = (world.rooms[there].tags ?? []).filter((t) => TERRAIN.includes(t));
  const passes: readonly Tag[] = terrain.length
    ? statusMovement(world, body).flatMap((m) => m.passes ?? [])
    : [];
  return terrain.every((t) => passes.includes(t));
}
