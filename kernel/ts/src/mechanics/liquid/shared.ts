import {
  LIMITS,
  type CommandPayload,
  type DefinitionRef,
  type DeltaOp,
  type EntityId,
  type ErrorCode,
  type LiquidRow,
  type Text,
} from '../../contracts.gen.ts';
import { liquidRowValid } from '../../foundation/compose_liquid.ts';
import { add, mul, sub } from '../../foundation/int.ts';
import { same } from '../../foundation/compose.ts';
import {
  bodyOf,
  refString,
  type Cartridge,
  type Entity,
  type Steps,
  type World,
} from '../../runtime/decision.ts';
import { living } from '../death/shared.ts';
import { opened } from '../lookups.ts';
import { carryingAdded } from '../containment/shared.ts';

type Payload = Extract<CommandPayload, { type: 'fill' | 'pour' | 'drink' }>;
export function initialLiquids(cartridge: Cartridge, entities: Readonly<Record<string, Entity>>) {
  const kinds = Object.keys(cartridge.liquids ?? {}).map((ref) => {
    const d = cartridge.liquids![ref];
    return {
      cartridge_id: cartridge.manifest.id,
      cartridge_version: cartridge.manifest.version,
      kind: 'liquid',
      key: d.key,
    } as DefinitionRef;
  });
  const liquids: Record<string, LiquidRow> = {};
  const liquidSpecs: Record<string, { capacity: number; kinds: readonly DefinitionRef[] }> = {};
  for (const [id, item] of Object.entries(entities))
    if (item.kind === 'item' && item.vessel) {
      liquids[id] = item.vessel.initial;
      liquidSpecs[id] = { capacity: item.vessel.capacity, kinds };
    }
  return { liquids, liquidSpecs };
}

/** Ownership and lid reach in one bounded walk; room reach alone does not confer custody. */
export function vesselUsable(
  world: World,
  body: EntityId,
  id: EntityId,
  steps: Steps,
): ErrorCode | undefined {
  if (!world.liquidSpecs[id] || world.entities[id]?.kind !== 'item') return 'invalid_target';
  const seen = new Set<string>();
  let at: string = id;
  while (at !== body) {
    if (++steps.n > LIMITS.query_steps) return 'budget_exceeded';
    if (seen.has(at)) return 'containment_cycle';
    seen.add(at);
    const parent = world.state.containers[at];
    if (parent === body) return;
    steps.n += Object.keys(world.slots).length;
    if (steps.n > LIMITS.query_steps) return 'budget_exceeded';
    if (!Object.values(world.slots).includes(parent) && !opened(world, parent, body))
      return 'not_present';
    at = parent;
  }
}

export function transition(world: World, p: Payload, steps: Steps = { n: 0 }) {
  const body = bodyOf(world, p.actor_id);
  if (!body || !living(world, body)) return 'invalid_state' as const;
  const source = p.type === 'pour' ? p.source_id : p.vessel_id;
  const ids = p.type === 'pour' ? [source, p.receiver_id] : [source];
  for (const id of ids) {
    const code = vesselUsable(world, body, id, steps);
    if (code) return code;
    if (!liquidRowValid(world.state.liquids?.[id], world.liquidSpecs[id]))
      return 'precondition_failed' as const;
  }
  return p.type === 'fill' ? fillPlan(world, p, body, steps) : consumePlan(world, p);
}

function change(world: World, id: EntityId, kind: DefinitionRef, quantity: number): DeltaOp {
  return {
    op: 'liquid.set',
    writer_group: 0,
    item_id: id,
    from: world.state.liquids![id],
    to: { kind: quantity ? kind : null, quantity },
  };
}

function fillPlan(
  world: World,
  p: Extract<Payload, { type: 'fill' }>,
  body: EntityId,
  steps: Steps,
) {
  const detail = world.details[p.source_id],
    from = world.state.liquids![p.vessel_id];
  if (!detail?.liquid_source || detail.room !== world.state.containers[body])
    return 'not_present' as const;
  const kind = detail.liquid_source;
  if (from.kind && !same(from.kind, kind)) return 'invalid_state' as const;
  const quantity = sub(world.liquidSpecs[p.vessel_id].capacity, from.quantity);
  if (!quantity) return 'invalid_state' as const;
  const liquid = world.cartridge.liquids?.[refString(kind)];
  if (
    !liquid ||
    !Number.isSafeInteger(liquid.grams_per_unit) ||
    liquid.grams_per_unit <= 0 ||
    liquid.grams_per_unit > 2147483647
  )
    return 'precondition_failed' as const;
  const heavy = carryingAdded(world, body, mul(quantity, liquid.grams_per_unit), steps);
  if (heavy) return heavy;
  return { ops: [change(world, p.vessel_id, kind, add(from.quantity, quantity))], kind, quantity };
}

/** Exact serving arithmetic shared with provider-owned services; custody stays with each consumer. */
export function serving(world: World, source: EntityId, kind: DefinitionRef) {
  const from = world.state.liquids?.[source];
  if (!liquidRowValid(from, world.liquidSpecs[source])) return 'precondition_failed' as const;
  if (!from?.kind || !same(from.kind, kind)) return 'invalid_state' as const;
  const quantity = world.cartridge.liquids?.[refString(kind)]?.drink_amount ?? 0;
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 2147483647)
    return 'precondition_failed' as const;
  if (from.quantity < quantity) return 'invalid_state' as const;
  return { ops: [change(world, source, kind, sub(from.quantity, quantity))], kind, quantity };
}

function consumePlan(world: World, p: Extract<Payload, { type: 'drink' | 'pour' }>) {
  const source = p.type === 'drink' ? p.vessel_id : p.source_id;
  const from = world.state.liquids![source];
  if (!from.kind) return 'invalid_state' as const;
  const kind = from.kind;
  if (p.type === 'drink') {
    return serving(world, source, kind);
  }
  const receiver = world.state.liquids![p.receiver_id];
  if (source === p.receiver_id || (receiver.kind && !same(kind, receiver.kind)))
    return 'invalid_state' as const;
  const quantity = Math.min(
    from.quantity,
    sub(world.liquidSpecs[p.receiver_id].capacity, receiver.quantity),
  );
  if (!quantity) return 'invalid_state' as const;
  return {
    ops: [
      change(world, source, kind, sub(from.quantity, quantity)),
      change(world, p.receiver_id, kind, add(receiver.quantity, quantity)),
    ],
    kind,
    quantity,
  };
}

export function liquidNarration(
  world: World,
  type: 'filled' | 'poured' | 'drank',
  kind: DefinitionRef,
  quantity: number,
): readonly Text[] {
  return [
    {
      key: `liquid.${type}` as never,
      bindings: {
        kind: world.cartridge.liquids![refString(kind)].label,
        unit_label: world.cartridge.liquids![refString(kind)].unit_label,
        quantity,
      },
    },
  ];
}

export function liquidPayload(p: Payload, kind: DefinitionRef, quantity: number) {
  return p.type === 'fill'
    ? ({ type: 'filled', source_id: p.source_id, vessel_id: p.vessel_id, kind, quantity } as const)
    : p.type === 'pour'
      ? ({
          type: 'poured',
          source_id: p.source_id,
          receiver_id: p.receiver_id,
          kind,
          quantity,
        } as const)
      : ({ type: 'drank', vessel_id: p.vessel_id, kind, quantity } as const);
}
