// One bounded admission/transition query for exact keyed service offers and execution.
import {
  LIMITS,
  type CommandPayload,
  type DeltaOp,
  type Key,
  type ErrorCode,
  type TextKey,
  type UnavailableReason,
  type ServiceDefinition,
  type EntityId,
} from '../../contracts.gen.ts';
import { same } from '../../foundation/compose.ts';
import { refusal } from '../../commands/actions.ts';
import { bodyOf, refString, type Steps, type World } from '../../runtime/decision.ts';
import { living } from '../death/shared.ts';
import { engaged } from '../combat/shared.ts';
import { assigned, value } from '../fact.ts';
import { adjust, level, resourceRef, resourceSpec, transfer } from '../resource.ts';
import { serving } from '../liquid/shared.ts';

type Payload = Extract<CommandPayload, { type: 'use_service' }>;
export function availability(world: World, p: Payload, steps: Steps = { n: 0 }, action?: Key) {
  const blocked = refusal(world, p, steps, action);
  return blocked ? { code: blocked as ErrorCode } : transition(world, p, steps);
}

export function transition(
  world: World,
  p: Payload,
  steps: Steps = { n: 0 },
): UnavailableReason | { ops: readonly DeltaOp[]; service: ServiceDefinition } {
  if (++steps.n > LIMITS.query_steps) return { code: 'budget_exceeded' as const };
  const body = bodyOf(world, p.actor_id);
  if (!body || (level(world, body, resourceRef(world, 'hp')) ?? 0) <= 0 || engaged(world, body))
    return { code: 'invalid_state' as const };
  const service = boundService(world, p, body);
  if ('code' in service) return service;
  if (p.quoted_price !== service.price) return { code: 'invalid_state' as const };
  const benefit = service.benefit;
  if (benefit.kind === 'entitlement' && value(world, p.actor_id, benefit.fact) !== false)
    return serviceRefusal('invalid_state', 'service.already_paid');
  const paid = transfer(world, body, p.provider_id, service.currency, p.quoted_price);
  if (!paid) return serviceRefusal('insufficient_resource', 'service.unaffordable');
  let ops: readonly DeltaOp[] = paid.ops;
  if (benefit.kind === 'entitlement') {
    const start = { ops, position: 0, facts: {} },
      grant = { fact: benefit.fact, value: true };
    ops = assigned(world, p.actor_id, start, grant, 'service').ops;
  } else {
    const recovered = recovery(world, p, body, benefit, ops);
    if ('code' in recovered) return recovered;
    ops = recovered.ops;
  }
  return { ops, service };
}

function boundService(world: World, p: Payload, body: EntityId) {
  const provider = world.entities[p.provider_id],
    service = world.cartridge.services?.[refString(p.service)];
  if (
    !service ||
    provider?.kind !== 'npc' ||
    world.entityIds[refString(service.provider)] !== p.provider_id ||
    !provider.services?.some((r) => same(r, p.service))
  )
    return { code: 'invalid_target' as const };
  if (
    !living(world, p.provider_id) ||
    world.state.containers[p.provider_id] !== world.state.containers[body]
  )
    return { code: 'not_present' as const };
  return service;
}

function serviceRefusal(code: ErrorCode, message: string) {
  return { code, message: { key: message as TextKey } };
}

function recovery(
  world: World,
  p: Payload,
  body: EntityId,
  benefit: Exclude<ServiceDefinition['benefit'], { kind: 'entitlement' }>,
  ops: readonly DeltaOp[],
): UnavailableReason | { ops: readonly DeltaOp[] } {
  const current = level(world, body, benefit.recovery),
    spec = resourceSpec(world, body, benefit.recovery);
  if (current === undefined || !spec) return { code: 'precondition_failed' as const };
  if (current >= spec.maximum) return serviceRefusal('invalid_state', 'service.full_mv');
  if (benefit.kind === 'meal') {
    const stock = level(world, p.provider_id, benefit.stock),
      stockSpec = resourceSpec(world, p.provider_id, benefit.stock);
    if (stock === undefined || !stockSpec) return { code: 'precondition_failed' as const };
    if (stock - benefit.debit < stockSpec.minimum)
      return serviceRefusal('insufficient_resource', 'service.sold_out');
    ops = [...ops, adjust(world, p.provider_id, benefit.stock, -benefit.debit, {}).op];
  } else {
    const vessel = world.entityIds[refString(benefit.vessel)];
    if (world.state.containers[vessel] !== p.provider_id) return { code: 'not_owned' as const };
    const consumed = serving(world, vessel, benefit.liquid);
    if (typeof consumed === 'string')
      return consumed === 'invalid_state'
        ? serviceRefusal(consumed, 'service.sold_out')
        : { code: consumed };
    ops = [...ops, ...consumed.ops];
  }
  ops = [
    ...ops,
    adjust(world, body, benefit.recovery, Math.min(benefit.amount, spec.maximum - current), {}).op,
  ];
  return { ops };
}
