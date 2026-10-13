// Toolbox row G7 (Beads loka-kgd.123; docs/system/mechanics.md access locks): an exit's
// `traverse`, a room's `enter` and an item's `get` and `put` lock name a policy@1 tree the actor
// must hold; a failing lock refuses permission_denied. Read by movementPlan, take (rule and
// GameView) and putRefused; writes nothing.
import type { CharacterId, EntityId, VersionedPolicy } from '../contracts.gen.ts';
import { LIMITS } from '../contracts.gen.ts';
import type { Steps, World } from '../runtime/decision.ts';
import { holds } from './policy.ts';

/** permission_denied when `lock` exists and does not hold for `actor` (target: the locked item). */
export function lockRefused(
  world: World,
  actor: CharacterId,
  lock: VersionedPolicy | undefined,
  target: EntityId | undefined,
  steps: Steps,
) {
  if (lock && !holds(world, actor, lock.root, { target, steps }))
    return 'permission_denied' as const;
}

/**
 * The custody walk: from `item` up State.containers while the holder is an item, one query step
 * per edge before its `access` lock is read (take's `get` from the taken item, put's `put` from
 * the destination); a cycle or the step budget faults as `reach` does.
 */
export function chainRefused(
  world: World,
  actor: CharacterId,
  item: EntityId,
  access: 'get' | 'put',
  steps: Steps,
) {
  const seen = new Set<string>();
  for (let at: EntityId = item; ; at = world.state.containers[at]) {
    const held = world.entities[at];
    if (held?.kind !== 'item') return;
    if (seen.has(at)) return 'containment_cycle' as const;
    if (++steps.n > LIMITS.query_steps) return 'budget_exceeded' as const;
    seen.add(at);
    const refused = lockRefused(world, actor, held.locks?.[access], at, steps);
    if (refused) return refused;
  }
}
