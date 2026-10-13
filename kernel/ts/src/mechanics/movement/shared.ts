import type {
  CharacterId,
  DefinitionRef,
  EntityId,
  RoomDefinition,
  Tag,
} from '../../contracts.gen.ts';
import { type World } from '../../runtime/decision.ts';
import { barrierState, exitOf } from '../lookups.ts';
import { bodyOf, refString, type Steps } from '../../runtime/decision.ts';
import { value } from '../fact.ts';
import { living } from '../death/shared.ts';
import { LIMITS } from '../../contracts.gen.ts';
import { KernelError } from '../../foundation/error.ts';
import { saturate } from '../../foundation/int.ts';
import { adjust, level, pay, resourceRef, resourceSpec, type Levels } from '../resource.ts';
import { held } from '../policy.ts';
import { cmp } from '../../foundation/validate.ts';
import { engaged } from '../combat/shared.ts';
import { mul } from '../../foundation/int.ts';
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
 * The one NPC exit check (toolbox row W26, Beads loka-kgd.32): why the NPC `npc` may not cross
 * the exit in `direction`: none there, a hidden face (whether or not the player found it) or a
 * climb face is not_found. Without a walker, then `passage`'s barrier refusal. A walker `npc`
 * (`walks`) crosses a closed barrier, a locked one only holding its key_item (the crossing
 * re-locks it: `relock`), and no G7 lock: any traverse lock on the exit or enter lock on the
 * destination refuses, unread (NPCs hold no grants). Undefined when it may.
 */
export function npcPassage(world: World, room: RoomDefinition, direction: string, npc?: EntityId) {
  const exit = exitOf(room, direction);
  if (!exit || exit.hidden_until || exit.climb) return 'not_found' as const;
  if (!npc) return passage(world, room, direction);
  const key = exit.barrier && world.cartridge.barriers![refString(exit.barrier)].key_item;
  if (
    exit.barrier &&
    barrierState(world, exit.barrier) === 'locked' &&
    !(key && held(world, world.entityIds[refString(key)], npc))
  )
    return 'exit_locked' as const;
  const there = world.roomIds[refString(exit.to)];
  if (exit.locks?.traverse || world.rooms[there]?.locks?.enter) return 'permission_denied' as const;
}

/**
 * A walking NPC's crossing of a locked barrier it holds the key of (toolbox row W26): unlocked,
 * opened, closed and locked again, each a barrier.transition with its barrier_changed payload.
 */
const RELOCK = [
  ['locked', 'closed'],
  ['closed', 'open'],
  ['open', 'closed'],
  ['closed', 'locked'],
] as const;
export const relock = (barrier: DefinitionRef) =>
  RELOCK.map(([from, to]) => ({
    op: { op: 'barrier.transition', writer_group: 0, barrier, from, to } as const,
    changed: { type: 'barrier_changed', barrier, from, to } as const,
  }));

/**
 * The locked barriers on the path a walking NPC `npc` takes from room `from` to room `to`
 * (toolbox row W26), in path order: breadth first over exits in direction-key order (the G6
 * bounded walk), crossing only exits `npcPassage` admits with walks, one query step per exit
 * tried, stopping at `to`. Undefined when `from` is no room or no path is found within the step
 * budget.
 */
export function walkPath(world: World, npc: EntityId, from: EntityId, to: EntityId, steps: Steps) {
  const via = new Map<string, { at: string; barrier?: DefinitionRef }>([[from, { at: from }]]);
  if (!world.rooms[from]) return undefined;
  for (let edge: string[] = [from]; edge.length && !via.has(to);) {
    const next: string[] = [];
    for (const at of edge) {
      const room = world.rooms[at];
      for (const direction of Object.keys(room.exits).sort(cmp)) {
        if (via.has(to)) break;
        if (++steps.n > LIMITS.query_steps) return undefined;
        const exit = exitOf(room, direction)!;
        const there = world.roomIds[refString(exit.to)];
        if (!there || via.has(there) || npcPassage(world, room, direction, npc)) continue;
        via.set(there, { at, barrier: exit.barrier });
        next.push(there);
      }
    }
    edge = next;
  }
  if (!via.has(to)) return undefined;
  const locked: DefinitionRef[] = [];
  for (let at: string = to; at !== from; at = via.get(at)!.at) {
    const { barrier } = via.get(at)!;
    if (barrier && barrierState(world, barrier) === 'locked') locked.unshift(barrier);
  }
  return locked;
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
  // Status reader 7: each active status's cost_percent in turn, rounded down (each step saturated at the
  // int32 ceiling, so an oversized fare is refused by pay, never an overflow fault); a fare of 0 writes nothing.
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
