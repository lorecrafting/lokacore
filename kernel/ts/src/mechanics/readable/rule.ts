// readable@1: fixed authored writing uses detail identity and normal narration receipts.
import type { CharacterId, EntityId } from '../../contracts.gen.ts';
import { accepted, bodyOf, rejected, type Rule, type World } from '../../runtime/decision.ts';

/** Shared target contract for command admission and its projected offer. */
export function readRefused(world: World, actor: CharacterId, target: EntityId) {
  const detail = world.details[target];
  if (!detail?.readable) return 'invalid_target';
  const body = bodyOf(world, actor);
  if (!body || detail.room !== world.state.containers[body]) return 'not_present';
}

export const decide: Rule<'readable'> = (world, command) => {
  const { actor_id, target_id } = command.payload;
  const code = readRefused(world, actor_id, target_id);
  if (code) return rejected(code);
  return accepted(world, 'read', [], [], [{ key: world.details[target_id].readable!.text }]);
};
