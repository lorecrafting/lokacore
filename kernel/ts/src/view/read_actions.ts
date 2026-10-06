import type { AdvertisedAction, CharacterId, EntityId } from '../contracts.gen.ts';
import { LIMITS } from '../contracts.gen.ts';
import { refusal, resolved } from '../commands/actions.ts';
import type { World } from '../runtime/decision.ts';
import { readRefused } from '../mechanics/readable/rule.ts';
import { visible } from '../mechanics/light/shared.ts';
import { KernelError } from '../foundation/error.ts';

// ponytail: reuse the flat detail table used by target resolution; index only if measured.
export function readActions(
  world: World,
  actor: CharacterId,
  set: ReturnType<typeof resolved>,
  steps: { n: number },
): AdvertisedAction[] {
  const actions = Object.values(set).filter(
    (a) =>
      a.command === 'read' &&
      a.target.kind === 'entity' &&
      a.target.scopes.includes('inspectable_details'),
  );
  if (!actions.length) return [];
  const result: AdvertisedAction[] = [];
  for (const id in world.details) {
    if (++steps.n > LIMITS.query_steps) throw new KernelError('budget_exceeded');
    const target_id = id as EntityId;
    if (readRefused(world, actor, target_id) || !visible(world, actor, target_id, steps)) continue;
    for (const a of actions) {
      if (result.length >= LIMITS.selector_cardinality) throw new KernelError('budget_exceeded');
      const code = refusal(world, { type: 'read', actor_id: actor, target_id }, steps, a.key, set);
      const shown = {
        action_key: a.key,
        label: world.details[id].readable!.label,
        target: a.target,
        input: a.input,
        target_ids: [target_id],
      };
      result.push(
        code ? { ...shown, available: false, reason: { code } } : { ...shown, available: true },
      );
    }
  }
  return result;
}
