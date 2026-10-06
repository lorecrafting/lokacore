import type { CharacterId, Command, Key } from '../../contracts.gen.ts';
import {
  bodyOf,
  COMPASS,
  rejected,
  type Mint,
  type Steps,
  type World,
} from '../../runtime/decision.ts';
import { refusal, composed } from '../../commands/actions.ts';
import { cmp } from '../../foundation/validate.ts';
import { uniform } from '../../foundation/rng.ts';
import { movementPlan, moveSequence } from '../movement/sequence.ts';
import { engaged } from './shared.ts';

/** Candidate selection is read-only and shares ordinary composed movement admission. */
export function escapeDirections(
  world: World,
  actor_id: CharacterId,
  steps: Steps = { n: 0 },
): Key[] {
  const body = bodyOf(world, actor_id);
  if (!body || !engaged(world, body)) return [];
  const set = composed(world, actor_id);
  return [...COMPASS]
    .sort(cmp)
    .filter(
      (direction) =>
        !refusal(world, { type: 'move', actor_id, direction }, steps, undefined, set) &&
        typeof movementPlan(world, actor_id, direction, steps, true) !== 'string',
    );
}

export function flee(
  world: World,
  command: Command & { payload: { type: 'flee' } },
  mint: Mint,
  steps: Steps,
) {
  const directions = escapeDirections(world, command.payload.actor_id, steps);
  if (!directions.length) return rejected('invalid_state');
  const [index, rng] =
    directions.length === 1 ? [0, world.state.rng] : uniform(world.state.rng, directions.length, 8);
  const moved = moveSequence(
    world,
    { ...command, payload: { ...command.payload, direction: directions[index] } },
    mint,
    'fled',
    steps,
  );
  return moved.kind === 'accepted' ? { ...moved, rng } : moved;
}
