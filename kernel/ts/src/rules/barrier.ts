// barrier@1 (capability_registry.json; 21 §5 Barrier; 04 §5.3 Lifecycle transition): open, close,
// lock and unlock the barrier on an exit of the actor's room, named by the exit's direction. A
// direction outside the compass is invalid_target, one without an exit here not_found, an exit
// without a barrier invalid_target. Only legal transitions (room.schema.json BarrierState): open
// needs closed (a locked barrier is exit_locked), close needs open, lock needs closed, unlock
// needs locked, else invalid_state; lock and unlock then need the barrier's key_item held by the
// actor's body, directly or inside what it holds (has_item), else not_owned. Accepted: one
// barrier.transition and barrier_changed. Every face of the door names this one state.
import type { BarrierState } from '../contracts.gen.ts';
import {
  accepted,
  barrierState,
  bodyOf,
  COMPASS,
  event,
  exitOf,
  refString,
  rejected,
  type Rule,
} from '../decision.ts';
import { holds } from '../policy.ts';

// Each command's required state, the state it leaves and its outcome.
const MOVES: Readonly<Record<string, [BarrierState, BarrierState, string]>> = {
  open: ['closed', 'open', 'opened'],
  close: ['open', 'closed', 'closed'],
  lock: ['closed', 'locked', 'locked'],
  unlock: ['locked', 'closed', 'unlocked'],
};

export const decide: Rule<'barrier'> = (world, command, mint) => {
  const { type, direction, actor_id } = command.payload;
  if (!COMPASS.includes(direction)) return rejected('invalid_target');
  const body = bodyOf(world, actor_id);
  if (!body) return rejected('not_found');
  const exit = exitOf(world.rooms[world.state.containers[body]], direction);
  if (!exit) return rejected('not_found');
  if (!exit.barrier) return rejected('invalid_target');
  const barrier = exit.barrier;
  const [need, to, outcome] = MOVES[type];
  const from = barrierState(world, barrier);
  if (from !== need)
    return rejected(type === 'open' && from === 'locked' ? 'exit_locked' : 'invalid_state');
  const item = world.cartridge.barriers![refString(barrier)].key_item;
  const keyed = type === 'lock' || type === 'unlock';
  if (keyed && !(item && holds(world, actor_id, { op: 'has_item', item })))
    return rejected('not_owned');
  const op = { op: 'barrier.transition', writer_group: 0, barrier, from, to } as const;
  const changed = { type: 'barrier_changed', barrier, from, to } as const;
  return accepted(world, outcome, [op], [event(world, command, mint, 1, changed)]);
};
