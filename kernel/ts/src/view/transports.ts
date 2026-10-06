import { availability } from '../mechanics/transport/shared.ts';
import { resolved } from '../commands/actions.ts';
import { KernelError } from '../foundation/error.ts';
import { refString, type World, type Steps } from '../runtime/decision.ts';
import type { EntityId, Key, TransportOffer } from '../contracts.gen.ts';

export function transportOffer(
  world: World,
  endpoint_id: EntityId,
  steps: Steps,
): TransportOffer | undefined {
  const detail = world.details[endpoint_id];
  if (!detail.transport) return;
  const route = detail.transport.route,
    t = world.cartridge.transports![refString(route)],
    a = resolved(world, world.character)[t.action];
  const result = availability(
    world,
    { type: 'use_transport', actor_id: world.character, endpoint_id, route, quoted_fare: t.fare },
    steps,
    t.action,
  );
  if (
    'code' in result &&
    (result.code === 'budget_exceeded' || result.code === 'precondition_failed')
  )
    throw new KernelError(result.code);
  return {
    route,
    fare: t.fare,
    charge: 'charge' in result ? (result.charge ?? t.fare) : t.fare,
    waived: 'waived' in result ? (result.waived ?? false) : false,
    label: t.label,
    action: {
      action_key: t.action,
      command: 'use_transport' as Key,
      label: t.label,
      target: a?.target ?? { kind: 'entity', scopes: ['inspectable_details'] },
      input: a?.input ?? ['route', 'quoted_fare'],
      target_ids: [endpoint_id],
      ...('code' in result
        ? {
            available: false,
            reason: {
              code: result.code,
              ...('message' in result && result.message ? { message: result.message } : {}),
            },
          }
        : { available: true }),
    },
  };
}
