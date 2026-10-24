import type { CharacterId, CommandPayload, EntityId, TextKey } from '../../contracts.gen.ts';
import type { Steps, World } from '../../runtime/decision.ts';
import { bodyOf } from '../../runtime/decision.ts';
import { describeEntity } from '../description_variant/rule.ts';

/** The engine line of a take, drop, give or put (loka-kgd.185): `item.<outcome>` binding the item's
 * short as the actor sees it (and the recipient's or container's), the actor as a participant; words: mobile/packages/game-view/line_words.ts. */
export function itemLine(world: World, p: CommandPayload, steps: Steps) {
  // Each named entity's short as the actor sees it: a status variant ("a notched sword") as on the page.
  const line = (
    q: { actor_id: CharacterId; item_id: EntityId },
    key: string,
    named: Record<string, EntityId> = {},
    role = {},
  ) => ({
    key: key as TextKey,
    bindings: Object.fromEntries(
      Object.entries({ item: q.item_id, ...named }).map(([slot, id]) => [
        slot,
        describeEntity(world, q.actor_id, id, 'short', steps),
      ]),
    ),
    participants: { actor: bodyOf(world, q.actor_id)!, ...role },
  });
  if (p.type === 'take') return line(p, 'item.taken');
  if (p.type === 'drop') return line(p, 'item.dropped');
  if (p.type === 'give')
    return line(p, 'item.given', { to: p.recipient_id }, { recipient: p.recipient_id });
  if (p.type === 'put')
    return line(p, 'item.put', { container: p.container_id }, { container: p.container_id });
  return undefined;
}
