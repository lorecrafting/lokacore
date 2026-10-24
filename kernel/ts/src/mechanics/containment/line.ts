import type { CommandPayload } from '../../contracts.gen.ts';
import type { Steps, World } from '../../runtime/decision.ts';
import { actorLine } from '../line.ts';

/** The engine line of a take, drop, give or put (loka-kgd.185): `item.<outcome>` binding the item's
 * short (and the recipient's or container's), the recipient or container also a participant. */
export function itemLine(world: World, p: CommandPayload, steps: Steps) {
  if (p.type === 'take')
    return actorLine(world, p.actor_id, 'item.taken', { item: p.item_id }, steps);
  if (p.type === 'drop')
    return actorLine(world, p.actor_id, 'item.dropped', { item: p.item_id }, steps);
  if (p.type === 'give') {
    const { actor_id, item_id, recipient_id } = p;
    return actorLine(world, actor_id, 'item.given', { item: item_id, to: recipient_id }, steps, {
      recipient: recipient_id,
    });
  }
  if (p.type === 'put') {
    const { actor_id, item_id, container_id } = p;
    return actorLine(
      world,
      actor_id,
      'item.put',
      { item: item_id, container: container_id },
      steps,
      {
        container: container_id,
      },
    );
  }
  return undefined;
}
