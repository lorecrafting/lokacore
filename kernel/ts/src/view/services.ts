import type {
  CharacterId,
  DefinitionRef,
  EntityId,
  Key,
  ServiceOffer,
  UnavailableReason,
} from '../contracts.gen.ts';
import { resolved } from '../commands/actions.ts';
import { KernelError } from '../foundation/error.ts';
import { refString, type World, type Steps } from '../runtime/decision.ts';
import { availability } from '../mechanics/service/shared.ts';

export function services(
  world: World,
  actor: CharacterId,
  provider: EntityId,
  steps: Steps,
): ServiceOffer[] | undefined {
  const npc = world.entities[provider];
  if (npc?.kind !== 'npc' || !npc.services) return;
  const set = resolved(world, actor);
  return npc.services.map((ref) => offer(world, actor, provider, ref, set, steps));
}

function offer(
  world: World,
  actor: CharacterId,
  provider: EntityId,
  ref: DefinitionRef,
  set: ReturnType<typeof resolved>,
  steps: Steps,
): ServiceOffer {
  const s = world.cartridge.services![refString(ref)],
    a = set[s.action];
  const result = availability(
    world,
    {
      type: 'use_service',
      actor_id: actor,
      provider_id: provider,
      service: ref,
      quoted_price: s.price,
    },
    steps,
    s.action,
  );
  assertResult(result);
  return {
    service: ref,
    label: s.label,
    price: s.price,
    benefit: s.benefit,
    action: {
      action_key: s.action,
      command: 'use_service' as Key,
      label: s.label,
      target: a?.target ?? { kind: 'entity', scopes: ['room_occupants'] },
      input: a?.input ?? ['service', 'quoted_price'],
      target_ids: [provider],
      ...('code' in result ? { available: false, reason: result } : { available: true }),
    },
  };
}

function assertResult(result: UnavailableReason | { ops: unknown }) {
  const code = 'code' in result ? result.code : undefined;
  if (code === 'budget_exceeded' || code === 'containment_cycle' || code === 'precondition_failed')
    throw new KernelError(code);
}
