// readable@1: exact held items compose with declared Boolean topics; room notices remain eventless.
import type { CharacterId, EntityId } from '../../contracts.gen.ts';
import {
  accepted,
  bodyOf,
  rejected,
  type Rule,
  type Steps,
  type World,
} from '../../runtime/decision.ts';
import { reach } from '../lookups.ts';
import { grant } from '../topics/shared.ts';

export function writing(world: World, target: EntityId) {
  const item = world.entities[target];
  return item?.kind === 'item' ? item.readable : world.details[target]?.readable;
}

/** Shared exact-target admission and projection with the command's custody query budget. */
export function readRefused(
  world: World,
  actor: CharacterId,
  target: EntityId,
  steps: Steps = { n: 0 },
) {
  if (!writing(world, target)) return 'invalid_target';
  const body = bodyOf(world, actor);
  if (!body) return 'not_present';
  if (world.entities[target]) {
    const held = reach(world, body, target, steps, true);
    return typeof held === 'string' ? held : held ? undefined : 'not_present';
  }
  if (world.details[target].room !== world.state.containers[body]) return 'not_present';
}

export const decide: Rule<'readable'> = (world, command, _mint, steps = { n: 0 }) => {
  const { actor_id, target_id } = command.payload;
  const code = readRefused(world, actor_id, target_id, steps);
  if (code) return rejected(code);
  const text = writing(world, target_id)!;
  const item = world.entities[target_id];
  const topic = item?.kind === 'item' && item.readable?.topic;
  const run = { ops: [], facts: {}, position: 0 };
  const ops = topic ? grant(world, actor_id, run, topic).ops : [];
  return accepted(world, 'read', ops, [], [{ key: text.text }]);
};
