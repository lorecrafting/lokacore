// barrier@1 (capability_registry.json; 21 §5 Barrier; 04 §5.3 Lifecycle transition): open, close,
// lock and unlock the barrier on an exit of the actor's room, named by the exit's direction, or
// on an item, named by its id (a container's lid; c1-locks). Neither or both is invalid_target. A
// direction outside the compass is invalid_target, one without an exit here not_found, an exit
// without a barrier invalid_target; a target that is no entity not_found, no item
// invalid_target, out of reach (mechanics/lookups.ts reach) not_present, without a barrier
// invalid_target. Only legal transitions (room.schema.json BarrierState): open needs closed (a
// locked barrier is exit_locked), close needs open, lock needs closed, unlock needs locked, else
// invalid_state; open then needs the barrier's opens_when to hold (toolbox row 10), else
// invalid_state; lock and unlock then need the barrier's key_item held by the actor's body,
// directly or inside what it holds (has_item), else not_owned. ponytail: has_item climbs a held
// locked chest too, so a key inside it opens it; custody for keys if content needs it. The loader
// rejects keys never reachable at load time, but play can lock a container holding its own key
// (runtime lockout) until put or a lockout rule exists. Accepted: one barrier.transition and barrier_changed. Every face of the door names
// this one state.
import type {
  BarrierState,
  CharacterId,
  DefinitionRef,
  EntityId,
  ErrorCode,
  Key,
} from '../../contracts.gen.ts';
import {
  accepted,
  bodyOf,
  COMPASS,
  has,
  event,
  refString,
  rejected,
  type Rule,
  type Steps,
  type World,
} from '../../runtime/decision.ts';
import { barrierState, exitOf, reach } from '../lookups.ts';
import { holds } from '../policy.ts';

// Each command's required state, the state it leaves and its outcome.
export const MOVES: Readonly<Record<string, [BarrierState, BarrierState, string]>> = {
  open: ['closed', 'open', 'opened'],
  close: ['open', 'closed', 'closed'],
  lock: ['closed', 'locked', 'locked'],
  unlock: ['locked', 'closed', 'unlocked'],
};

export const decide: Rule<'barrier'> = (world, command, mint, steps = { n: 0 }) => {
  const { type, actor_id } = command.payload;
  if (type === 'knock') {
    const reply = knock(world, actor_id, command.payload.direction);
    return typeof reply === 'string'
      ? rejected(reply)
      : accepted(world, 'knocked', [], [], [{ key: reply.text }]);
  }
  const t = transition(world, actor_id, type, command.payload, steps);
  if (typeof t === 'string')
    return t === 'containment_cycle' || t === 'budget_exceeded'
      ? { kind: 'fault', code: t }
      : rejected(t);
  const { barrier, from, to, outcome } = t;
  const op = { op: 'barrier.transition', writer_group: 0, barrier, from, to } as const;
  const changed = { type: 'barrier_changed', barrier, from, to } as const;
  return accepted(world, outcome, [op], [event(world, command, mint, 1, changed)]);
};

/** Where a door verb acts: an exit's direction or an item's id, exactly one. */
export type Site = { readonly direction?: Key; readonly target_id?: EntityId };

/**
 * Why `type` (open, close, lock or unlock) by `actor_id` on the barrier at `site` is refused
 * now, else its barrier's transition and outcome. Read-only, shared with the GameView's door and
 * container verbs (view/action_lists.ts); each policy leaf it evaluates adds one to `steps`.
 */
export function transition(
  world: World,
  actor_id: CharacterId,
  type: string,
  site: Site,
  steps: Steps,
) {
  const one = (site.direction === undefined) !== (site.target_id === undefined);
  const barrier = !one
    ? 'invalid_target'
    : site.direction !== undefined
      ? exitBarrier(world, actor_id, site.direction)
      : itemBarrier(world, actor_id, site.target_id!, steps);
  if (typeof barrier === 'string') return barrier;
  const [need, to, outcome] = MOVES[type];
  const from = barrierState(world, barrier);
  if (from !== need) return type === 'open' && from === 'locked' ? 'exit_locked' : 'invalid_state';
  const def = world.cartridge.barriers![refString(barrier)];
  // Toolbox row 10: an authored condition (an hour window, a moon phase) gates opening only.
  if (type === 'open' && def.opens_when && !holds(world, actor_id, def.opens_when.root, { steps }))
    return 'invalid_state';
  const item = def.key_item;
  const keyed = type === 'lock' || type === 'unlock';
  if (keyed && !(item && holds(world, actor_id, { op: 'has_item', item }, { steps })))
    return 'not_owned';
  return { barrier, from, to, outcome };
}

// The barrier on the exit in `direction` of the actor's room, else why not.
function exitBarrier(world: World, actor: CharacterId, direction: Key): DefinitionRef | ErrorCode {
  if (!COMPASS.includes(direction)) return 'invalid_target';
  const body = bodyOf(world, actor);
  if (!body) return 'not_found';
  const exit = exitOf(world.rooms[world.state.containers[body]], direction);
  return !exit ? 'not_found' : (exit.barrier ?? 'invalid_target');
}

// The barrier on item `id` in the actor's reach, else why not.
function itemBarrier(
  world: World,
  actor: CharacterId,
  id: EntityId,
  steps: Steps,
): DefinitionRef | ErrorCode {
  const body = bodyOf(world, actor);
  if (!body || !has(world.entities, id)) return 'not_found';
  const e = world.entities[id];
  if (e.kind !== 'item') return 'invalid_target';
  const reached = reach(world, body, id, steps);
  if (typeof reached === 'string') return reached;
  return reached ? (e.barrier ?? 'invalid_target') : 'not_present';
}

/** The authored local response; shared with the offered door action. */
export function knock(world: World, actor: CharacterId, direction: Key) {
  if (!COMPASS.includes(direction)) return 'invalid_target' as const;
  const body = bodyOf(world, actor);
  if (!body) return 'not_found' as const;
  const exit = exitOf(world.rooms[world.state.containers[body]], direction);
  if (!exit) return 'not_found' as const;
  if (!exit.barrier || !exit.knock) return 'invalid_target' as const;
  const response = exit.knock;
  const npc = world.entityIds[refString(response.npc)];
  const room = world.roomIds[refString(response.room)];
  return { text: world.state.containers[npc] === room ? response.answered : response.unanswered };
}
