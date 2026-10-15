// Put and Give list one offer per admitted [item, target] pair on the held item (book-ui.md
// "Item details"); every other action keeps its one offer.
import { LIMITS } from '../contracts.gen.ts';
import type { AdvertisedAction, CharacterId, EntityId } from '../contracts.gen.ts';
import { putRefused, recipient } from '../mechanics/containment/shared.ts';
import type { World } from '../runtime/decision.ts';

export function itemPairs(
  world: World,
  actor: CharacterId,
  body: EntityId,
  item: EntityId,
  command: string,
  shown: AdvertisedAction,
  steps: { n: number },
): AdvertisedAction[] {
  if (command === 'put')
    return pairs(world, body, item, shown, steps, 'item', (t) =>
      putRefused(world, actor, body, item, t, steps),
    );
  if (command !== 'give') return [shown];
  // A refused item lists no Give pair; exhaustion still replaces the offer.
  if (!shown.available && shown.reason.code !== 'budget_exceeded') return [];
  const here = world.state.containers[body]!;
  return pairs(world, body, item, shown, steps, 'npc', (t) => recipient(world, t, here));
}

// Enumerate bounded concrete pairs (Put: [item, container]; Give: [item, recipient]) under the
// command's own refusal; exhaustion replaces the whole source offer, never a prefix.
function pairs(
  world: World,
  body: EntityId,
  item: EntityId,
  shown: AdvertisedAction,
  steps: { n: number },
  kind: 'item' | 'npc',
  refused: (target: EntityId) => string | undefined,
): AdvertisedAction[] {
  if (world.state.containers[item] !== body) return [];
  const found: AdvertisedAction[] = [];
  for (const id in world.entities) {
    if (!Object.hasOwn(world.entities, id)) continue;
    if (++steps.n > LIMITS.query_steps)
      return [{ ...shown, available: false, reason: { code: 'budget_exceeded' } }];
    if (world.entities[id].kind !== kind || id === item) continue;
    const code = refused(id as EntityId);
    if (code === 'budget_exceeded') return [{ ...shown, available: false, reason: { code } }];
    if (!code) found.push({ ...shown, target_ids: [item, id as EntityId] });
  }
  return found;
}
