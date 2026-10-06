import { CAPABILITY_OWNERS, type DecisionResult } from '../contracts.gen.ts';
import { COMPOSES } from './decision.ts';

// The capability owning a command or event type; own keys only, so `constructor` names none.
export const ownerOf = (owners: Readonly<Record<string, string>>, type: string) =>
  Object.hasOwn(owners, type) ? owners[type]!.split('@')[0] : undefined;

/**
 * An accepted rule result as the host admits it (04 §5.2 step 7): an event type neither the
 * owning capability nor one it COMPOSES owns faults unowned_event, which discards the whole
 * proposal. adopt() checks the output budget once the host's events are added.
 */
export function admit(owner: string, decision: DecisionResult): Admitted {
  if (decision.kind !== 'accepted') return decision as Admitted;
  const may: readonly unknown[] = [owner, ...(COMPOSES[owner as keyof typeof COMPOSES] ?? [])];
  if (decision.events.some((e) => !may.includes(ownerOf(CAPABILITY_OWNERS.event, e.payload.type))))
    return { kind: 'fault', code: 'unowned_event' } as Admitted;
  return decision as Admitted;
}

declare const ADMITTED: unique symbol;
/** A DecisionResult that passed admit(); adopt() takes only this, so step cannot skip admit. */
export type Admitted = DecisionResult & { readonly [ADMITTED]: true };
