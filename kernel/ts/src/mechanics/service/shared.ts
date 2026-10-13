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
import { assigned, bounded, value } from '../fact.ts';
import { equipped } from '../lookups.ts';
import { adjust, level, resourceRef, resourceSpec, transfer } from '../resource.ts';
import { serving } from '../liquid/shared.ts';
import { selected } from '../containment/stock.ts';
import { giveRefused } from '../containment/shared.ts';

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
  const escrow = benefit.kind === 'entitlement' ? benefit.escrow : undefined;
  if (benefit.kind === 'entitlement' && value(world, p.actor_id, benefit.fact) !== false)
    return serviceRefusal('invalid_state', escrow ? 'service.order_open' : 'service.already_paid');
  const inputs = escrowed(world, body, escrow, steps);
  if ('code' in inputs) return inputs;
  const paid = transfer(world, body, p.provider_id, service.currency, p.quoted_price);
  if (!paid) return serviceRefusal('insufficient_resource', 'service.unaffordable');
  let ops: readonly DeltaOp[] = paid.ops;
  if (benefit.kind === 'entitlement') {
    const start = { ops: [...ops, ...inputs.ops], position: 0, facts: {} },
      grant = { fact: benefit.fact, value: true };
    ops = assigned(world, p.actor_id, start, grant, 'service').ops;
  } else if (benefit.kind === 'repair') {
    const repaired = repair(world, p, body, benefit, ops);
    if ('code' in repaired) return repaired;
    ops = repaired.ops;
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

type Escrow = Extract<ServiceDefinition['benefit'], { kind: 'entitlement' }>['escrow'];

// Toolbox row 20a: the first `quantity` escrow inputs directly in the body, each one Give would
// let go, move to the custody room with the order; fewer held refuses before any payment.
function escrowed(
  world: World,
  body: EntityId,
  escrow: Escrow,
  steps: Steps,
): UnavailableReason | { ops: readonly DeltaOp[] } {
  if (!escrow) return { ops: [] };
  const ids = selected(world, escrow.items, body, escrow.quantity, steps);
  if (typeof ids === 'string') return { code: ids };
  if (ids.length < escrow.quantity) return serviceRefusal('not_owned', 'service.missing_inputs');
  for (const id of ids) {
    const code = giveRefused(world, id, steps);
    if (code) return { code };
  }
  const destination_id = world.roomIds[refString(escrow.custody)];
  return {
    ops: ids.map((entity_id) => ({
      op: 'entity.transfer' as const,
      writer_group: 0,
      entity_id,
      source_id: body,
      destination_id,
    })),
  };
}

// Toolbox row 21: the wielded weapon whose durability is the benefit's fact gains up to `amount`,
// capped at the fact's maximum; none wielded, or one already at the maximum, refuses.
function repair(
  world: World,
  p: Payload,
  body: EntityId,
  benefit: Extract<ServiceDefinition['benefit'], { kind: 'repair' }>,
  ops: readonly DeltaOp[],
): UnavailableReason | { ops: readonly DeltaOp[] } {
  const wielded = equipped(world, body, 'wield');
  const d = wielded?.item.weapon?.durability;
  if (!d || !same(d.fact, benefit.fact))
    return serviceRefusal('invalid_state', 'service.nothing_to_repair');
  const current = value(world, p.actor_id, d.fact, wielded!.id);
  const next = bounded(world, d.fact, current, benefit.amount);
  if (next === undefined) return { code: 'precondition_failed' as const };
  if (next === current) return serviceRefusal('invalid_state', 'service.full_durability');
  const start = { ops, position: 0, facts: {} },
    step = { fact: d.fact, value: next, subject: wielded!.id };
  return { ops: assigned(world, p.actor_id, start, step, 'durability').ops };
}

function recovery(
  world: World,
  p: Payload,
  body: EntityId,
  benefit: Extract<ServiceDefinition['benefit'], { kind: 'meal' | 'drink' }>,
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
