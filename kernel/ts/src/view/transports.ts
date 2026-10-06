import { availability } from '../mechanics/transport/shared.ts';
import { KernelError } from '../foundation/error.ts';
import { refString, type World, type Steps } from '../runtime/decision.ts';
import type { EntityId, Key, TransportOffer } from '../contracts.gen.ts';

export function transportOffer(w: World, id: EntityId, steps: Steps): TransportOffer | undefined {
  const route = w.details[id].transport?.route;
  if (!route) return;
  const t = w.cartridge.transports![refString(route)];
  const r = availability(
    w,
    {
      type: 'use_transport',
      actor_id: w.character,
      endpoint_id: id,
      route,
      quoted_fare: t.fare,
    },
    steps,
    t.action,
  );
  const code = 'code' in r ? r.code : undefined;
  if (code === 'budget_exceeded' || code === 'precondition_failed') throw new KernelError(code);
  return {
    route,
    fare: t.fare,
    charge: 'charge' in r ? (r.charge ?? t.fare) : t.fare,
    waived: 'waived' in r ? (r.waived ?? false) : false,
    label: t.label,
    action: {
      action_key: t.action,
      command: 'use_transport' as Key,
      label: t.label,
      target: { kind: 'entity', scopes: ['inspectable_details'] },
      input: ['route', 'quoted_fare'],
      target_ids: [id],
      ...(code
        ? {
            available: false,
            reason: { code, ...('message' in r && r.message ? { message: r.message } : {}) },
          }
        : { available: true }),
    },
  };
}
