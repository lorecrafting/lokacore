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
  type DefinitionRef,
  type JobId,
} from '../../contracts.gen.ts';
import { same } from '../../foundation/compose.ts';
import { refusal } from '../../commands/actions.ts';
import { bodyOf, refString, type Mint, type Steps, type World } from '../../runtime/decision.ts';
import { living } from '../death/shared.ts';
import { engaged } from '../combat/shared.ts';
import { assigned, bounded, value } from '../fact.ts';
import { equipped } from '../lookups.ts';
import { adjust, level, resourceRef, resourceSpec, transfer, type Levels } from '../resource.ts';
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
  if (escrow?.output && away(world, escrow))
    return serviceRefusal('not_found', 'service.no_output');
  const inputs = escrowed(world, body, escrow, steps);
  if ('code' in inputs) return inputs;
  const order: UnavailableReason | Order | undefined =
    benefit.kind === 'claim' || benefit.kind === 'cancel' ? open(world, p, benefit) : undefined;
  if (order && 'code' in order) return order;
  const paid = transfer(world, body, p.provider_id, service.currency, p.quoted_price);
  if (!paid) return serviceRefusal('insufficient_resource', 'service.unaffordable');
  const done = granted(world, p, body, service, order, paid, inputs.ops, steps);
  return 'code' in done ? done : { ops: done.ops, service };
}

// The service's benefit after payment: settle an order, grant an entitlement (taking any escrow
// inputs), bank, repair, or recover.
function granted(
  world: World,
  p: Payload,
  body: EntityId,
  service: ServiceDefinition,
  order: Order | undefined,
  paid: { ops: readonly DeltaOp[]; levels: Levels },
  inputs: readonly DeltaOp[],
  steps: Steps,
): UnavailableReason | { ops: readonly DeltaOp[] } {
  const { benefit } = service,
    { ops } = paid;
  if (benefit.kind === 'deposit' || benefit.kind === 'withdraw')
    return banked(world, p, body, service.currency, benefit, paid);
  if (benefit.kind === 'entitlement') {
    const start = { ops: [...ops, ...inputs], position: 0, facts: {} },
      grant = { fact: benefit.fact, value: true };
    return assigned(world, p.actor_id, start, grant, 'service');
  }
  if (benefit.kind === 'repair') return repair(world, p, body, benefit, ops);
  if (benefit.kind === 'claim' || benefit.kind === 'cancel')
    return settle(world, p, body, order!, ops, steps);
  return recovery(world, p, body, benefit, ops);
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

/** Toolbox row 20b: the engine job a timed commission's order waits for. */
export const orderJob = (service: DefinitionRef): DefinitionRef => ({ ...service, kind: 'order' });

// Toolbox row 20b: a timed commission's order waits for one job, due ready_after from now.
export function scheduled(world: World, p: Payload, s: ServiceDefinition, mint: Mint): DeltaOp[] {
  const after = s.benefit.kind === 'entitlement' ? s.benefit.escrow?.ready_after : undefined;
  if (!after) return [];
  const due_time = world.state.clock + after;
  return [
    {
      op: 'job.schedule',
      writer_group: 0,
      job_id: mint() as JobId,
      job: orderJob(p.service),
      due_time,
    },
  ];
}

type Settles = Extract<ServiceDefinition['benefit'], { kind: 'claim' | 'cancel' }>;
type Order = { kind: Settles['kind']; commission: ServiceDefinition; escrow: NonNullable<Escrow> };

// Toolbox row 20b: the open order a claim or cancel settles, refused before any payment. Ready is
// the order open and its job no longer pending.
function open(world: World, p: Payload, benefit: Settles): UnavailableReason | Order {
  const commission = world.cartridge.services![refString(benefit.service)]!;
  const b = commission.benefit as Extract<ServiceDefinition['benefit'], { kind: 'entitlement' }>;
  if (value(world, p.actor_id, b.fact) !== true)
    return serviceRefusal('invalid_state', 'service.no_order');
  const job = refString(orderJob(benefit.service));
  const busy = Object.values(world.state.jobs ?? {}).some(
    (r) => r.status === 'pending' && refString(r.job) === job,
  );
  if (benefit.kind === 'claim' && busy) return serviceRefusal('invalid_state', 'service.not_ready');
  if (benefit.kind === 'cancel' && !busy) return serviceRefusal('invalid_state', 'service.ready');
  const escrow = b.escrow!;
  if (benefit.kind === 'claim' && away(world, escrow))
    return serviceRefusal('not_found', 'service.no_output');
  return { kind: benefit.kind, commission, escrow };
}

// A timed commission's output not lying in custody: nothing to order or claim.
function away(world: World, escrow: NonNullable<Escrow>) {
  const output = world.entityIds[refString(escrow.output!)];
  return world.state.containers[output] !== world.roomIds[refString(escrow.custody)];
}

// A claim takes the output from custody; a cancel returns the first `quantity` inputs in custody,
// never the fee. Both close the order; the job stays and completes inert.
function settle(
  world: World,
  p: Payload,
  body: EntityId,
  { kind, commission, escrow }: Order,
  paid: readonly DeltaOp[],
  steps: Steps,
): UnavailableReason | { ops: readonly DeltaOp[] } {
  const custody = world.roomIds[refString(escrow.custody)];
  let ids = [world.entityIds[refString(escrow.output!)]];
  if (kind === 'cancel') {
    const back = selected(world, escrow.items, custody, escrow.quantity, steps);
    if (typeof back === 'string') return { code: back };
    ids = back;
  }
  const moves = ids.map((entity_id) => ({
    op: 'entity.transfer' as const,
    writer_group: 0,
    entity_id,
    source_id: custody,
    destination_id: body,
  }));
  const start = { ops: [...paid, ...moves], position: 0, facts: {} };
  const b = commission.benefit as Extract<ServiceDefinition['benefit'], { kind: 'entitlement' }>;
  return { ops: assigned(world, p.actor_id, start, { fact: b.fact, value: false }, 'service').ops };
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

// Toolbox row 25: `amount` moves between the body and the vault on the levels the fee left, and
// the service-owned account follows it; the vault short or a bound passed refuses.
function banked(
  world: World,
  p: Payload,
  body: EntityId,
  currency: DefinitionRef,
  benefit: Extract<ServiceDefinition['benefit'], { kind: 'deposit' | 'withdraw' }>,
  paid: { ops: readonly DeltaOp[]; levels: Levels },
): UnavailableReason | { ops: readonly DeltaOp[] } {
  const vault = world.entityIds[refString(benefit.vault)],
    deposit = benefit.kind === 'deposit',
    by = deposit ? benefit.amount : -benefit.amount,
    current = value(world, p.actor_id, benefit.account),
    next = bounded(world, benefit.account, current, by);
  const [from, to] = deposit ? [body, vault] : [vault, body];
  const moved = transfer(world, from, to, currency, benefit.amount, paid.levels);
  if (!moved || next === undefined || next !== Number(current) + by)
    return deposit
      ? serviceRefusal('insufficient_resource', 'service.unaffordable')
      : serviceRefusal('invalid_state', 'service.no_funds');
  const start = { ops: [...paid.ops, ...moved.ops], position: 0, facts: {} };
  return assigned(world, p.actor_id, start, { fact: benefit.account, value: next }, 'service');
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
