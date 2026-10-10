import type { CharacterId, EntityId, RoomDefinition } from '../../contracts.gen.ts';
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
import { mul } from '../../foundation/int.ts';

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
 * True while the exit in `direction` is hidden from `actor` (toolbox row 11): it declares
 * hidden_until and the actor's value of its fact differs. A hidden exit does not exist for that
 * actor: not listed, not seen through, not mapped, and a move through it is not_found.
 */
export function hidden(world: World, room: RoomDefinition, direction: string, actor: CharacterId) {
  const until = exitOf(room, direction)?.hidden_until;
  return !!until && value(world, actor, until.fact) !== until.equals;
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
  return cost ? pay(world, body, [{ ...cost, amount: mul(cost.amount, multiplier) }]) : { ops: [] };
}
