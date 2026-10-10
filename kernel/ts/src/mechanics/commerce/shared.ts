import {
  LIMITS,
  type CharacterId,
  type EntityId,
  type NpcDefinition,
  type ShopItemView,
} from '../../contracts.gen.ts';
import { bodyOf, refString, type Steps, type World } from '../../runtime/decision.ts';
import { living } from '../death/shared.ts';
import { engaged } from '../combat/shared.ts';
import { transfer } from '../resource.ts';
import { carrying, giveRefused } from '../containment/shared.ts';
import { status } from '../skills.ts';
import { disposition } from '../disposition.ts';

// A friendly discount (toolbox row 15) takes the NPC's disposition (row G11), a skill one the skill.
function buyPrice(world: World, actor: CharacterId, npc: EntityId, base: number, steps: Steps) {
  const d = (world.entities[npc] as NpcDefinition).shop!.buy_discount;
  return d &&
    (d.friendly
      ? disposition(world, actor, npc, steps) === 'friendly'
      : status(world, actor, d.skill!, steps).usable)
    ? Math.max(d.minimum, Math.floor((base * d.numerator) / d.denominator))
    : base;
}

/**
 * One current offer query serves both the rule and Peg's page; no stock reservation. A hostile
 * shopkeeper (toolbox row G11) refuses as a stale price does.
 */
export function exchange(
  world: World,
  actor: CharacterId,
  provider: EntityId,
  item: EntityId,
  verb: 'buy' | 'sell',
  price: number,
  steps: Steps = { n: 0 },
) {
  if (++steps.n > LIMITS.query_steps) return 'budget_exceeded' as const;
  const body = bodyOf(world, actor);
  const npc = world.entities[provider];
  if (body && engaged(world, body)) return 'invalid_state' as const;
  if (!body || !npc || !world.entities[item]) return 'not_found' as const;
  if (npc.kind !== 'npc' || !npc.shop) return 'invalid_target' as const;
  if (!living(world, provider) || world.state.containers[provider] !== world.state.containers[body])
    return 'not_present' as const;
  const offer = npc.shop.offers.find((o) => world.entityIds[refString(o.item)] === item);
  if (!offer) return 'invalid_target' as const;
  const current = verb === 'buy' ? buyPrice(world, actor, provider, offer.buy, steps) : offer.sell;
  if (price !== current || disposition(world, actor, provider, steps) === 'hostile')
    return 'invalid_state' as const;
  const [source, destination] = verb === 'buy' ? [provider, body] : [body, provider];
  if (world.state.containers[item] !== source) return 'not_owned' as const;
  const custody =
    verb === 'buy' ? carrying(world, body, steps)(item) : giveRefused(world, item, steps);
  if (custody) return custody;
  if (world.capacities[destination] !== undefined) {
    let held = 0;
    for (const at of Object.values(world.state.containers)) {
      if (++steps.n > LIMITS.query_steps) return 'budget_exceeded' as const;
      if (at === destination) held++;
    }
    if (held >= world.capacities[destination]) return 'invalid_state' as const;
  }
  const paid = transfer(world, destination, source, npc.shop.resource, price);
  return paid
    ? { body, source, destination, paid, shop: npc.shop }
    : ('insufficient_resource' as const);
}

export function shelf(world: World, provider: EntityId): ShopItemView[] | undefined {
  const npc = world.entities[provider];
  if (npc?.kind !== 'npc' || !npc.shop) return;
  const steps = { n: 0 };
  return npc.shop.offers.map((o) => {
    const item_id = world.entityIds[refString(o.item)];
    const action = (verb: 'buy' | 'sell') => {
      const price =
        verb === 'buy' ? buyPrice(world, world.character, provider, o.buy, steps) : o.sell;
      const result = exchange(world, world.character, provider, item_id, verb, price, steps);
      return {
        price,
        available: typeof result !== 'string',
        ...(typeof result === 'string' && { reason: result }),
      };
    };
    return {
      item_id,
      name: world.entities[item_id].short,
      buy: action('buy'),
      sell: action('sell'),
    };
  });
}
