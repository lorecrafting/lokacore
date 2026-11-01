// resource@1: pure resource queries and exact adjustments. Legacy gain crosses hour
// boundaries; opted recovery settles the old stored position rate and fractional credit.
import { capped, validOverrideRow } from '../foundation/resource.ts';
import { current, key, same } from '../foundation/compose.ts';
import type {
  CharacterId,
  DefinitionRef,
  DeltaOp,
  DomainEvent,
  EntityId,
  Key,
  MutationTarget,
  ActionCost,
  ResourceRegen,
  Text,
  TextKey,
} from '../contracts.gen.ts';
import { actorOf, admitted, bodyOf, type World } from '../runtime/decision.ts';
import { add, saturate } from '../foundation/int.ts';
import { fact, positionOf } from './position/shared.ts';
import { cmp } from '../foundation/validate.ts';
import { derived } from './attribute/shared.ts';

type Adjust = Extract<DeltaOp, { op: 'resource.adjust' }>;
/** A decision's resource values so far, by canonical resource target text. */
export type Levels = Readonly<Record<string, number>>;

/** This cartridge's resource `k` (the engine pools are hp, ma and mv). */
export const resourceRef = (world: World, k: string): DefinitionRef => ({
  cartridge_id: world.cartridge.manifest.id,
  cartridge_version: world.cartridge.manifest.version,
  kind: 'resource' as Key,
  key: k as Key,
});

/**
 * A character body's pool maxima moved by the derived hp_max table (mechanics.md resource@1), by
 * canonical resource target ({} for any other body); composition reads the same map (runtime/apply.ts base).
 */
export function maxima(world: World, body: EntityId): Readonly<Record<string, number>> {
  const table = world.cartridge.world?.derived?.hp_max;
  const actor = actorOf(world, body);
  if (!table || !actor) return {}; // cheap bail first: resourceSpec calls this for every entity
  const hp = resourceRef(world, 'hp');
  const at = key({ kind: 'resource', resource: hp, entity_id: body });
  const spec = world.resourceSpecs[key(hp)];
  if (!spec || world.entityResourceSpecs[at]) return {};
  const maximum = saturate(spec.maximum + derived(world, actor, table));
  return { [at]: Math.max(spec.minimum, maximum) };
}

/**
 * A zero-amount hp adjust when the hp maximum is derived, written before an attribute change moves
 * it, so credit banked under the old maximum settles there and the new one is reached by
 * regeneration (resource@1).
 */
export const settleMaxima = (world: World) =>
  admitted(world).flatMap(([, body]) =>
    Object.keys(maxima(world, body)).length
      ? [adjust(world, body, resourceRef(world, 'hp'), 0, {}).op]
      : [],
  );

/** Effective definition for this exact resource target, falling back to the pool. */
export function resourceSpec(world: World, entity: EntityId, resource: DefinitionRef) {
  const at = key({ kind: 'resource', resource, entity_id: entity });
  const spec = world.entityResourceSpecs[at] ?? world.resourceSpecs[key(resource)];
  const maximum = spec ? maxima(world, entity)[at] : undefined;
  return maximum === undefined ? spec : { ...spec, maximum };
}

/** What a blow can take: it stops at the authored floor, as a spell's damage does, and at 0, where death fires. */
export function aboveFloor(world: World, entity: EntityId, resource: DefinitionRef) {
  return (
    level(world, entity, resource)! - Math.max(0, resourceSpec(world, entity, resource).minimum)
  );
}

/** `entity`'s current value of `resource` at the world's clock; undefined if undeclared. */
export function level(world: World, entity: EntityId, resource: DefinitionRef): number | undefined {
  const spec = resourceSpec(world, entity, resource);
  if (!spec) return undefined;
  const at = key({ kind: 'resource', resource, entity_id: entity });
  const row = world.state.resources?.[at];
  const override = world.entityResourceSpecs[at];
  if (override && !validOverrideRow(row, override, world.state.clock)) return undefined;
  const authored = override ?? world.resourceSpecs[key(resource)];
  return current(spec === authored ? row : capped(row, spec.maximum), spec, world.state.clock);
}

/**
 * The resource.adjust of `resource` by `by` (checked arithmetic), from its value as `levels`
 * left it in this decision (else its current value), and the levels after it. `saturate` (a
 * scripted action step, Step: add by, stopping at the bounds) stops the result at the resource's
 * bounds; otherwise a result out of bounds is left for composition to fault. The op itself is
 * always exact.
 */
export function adjust(
  world: World,
  entity: EntityId,
  resource: DefinitionRef,
  by: number,
  levels: Levels,
  saturate = false,
): { op: Adjust; levels: Levels } {
  const at = key({ kind: 'resource', resource, entity_id: entity });
  const from = levels[at] ?? level(world, entity, resource)!;
  const { minimum, maximum } = resourceSpec(world, entity, resource);
  const exact = add(from, by);
  const to = saturate ? Math.min(maximum, Math.max(minimum, exact)) : exact;
  const op: Adjust = {
    op: 'resource.adjust',
    writer_group: 0,
    resource,
    entity_id: entity,
    from,
    to,
  };
  return { op, levels: { ...levels, [at]: to } };
}

const pool = (o: { resource: DefinitionRef; entity_id: EntityId }) =>
  key({ kind: 'resource', resource: o.resource, entity_id: o.entity_id });

/**
 * A reaction's resource.adjust on the actor's body, clamped to its bounds and after the rule's
 * earlier `ops`, so two compose. Nothing without a body or a change, or at the moment the body died:
 * the death's authored return stands. `at`: the composer folds from the base clock otherwise and
 * refuses the settled regen. Its group: the pool's earlier writer's (a bite in the killing round),
 * else the body's holder's, else its own, which it holds, so a same-due job on the body joins it.
 */
export function pooled(
  then: World,
  actor: CharacterId,
  step: { resource: DefinitionRef; by: number },
  group: number,
  ops: readonly DeltaOp[],
  holders: Map<string, number>,
  events: readonly DomainEvent[],
): DeltaOp[] {
  const body = bodyOf(then, actor);
  const died = (e: DomainEvent) =>
    e.payload.type === 'entity_died' &&
    e.payload.victim_id === body &&
    e.logical_time === then.state.clock;
  if (!body || events.some(died)) return [];
  const levels: Record<string, number> = {};
  for (const o of ops) if (o.op === 'resource.adjust') levels[pool(o)] = o.to;
  const { op } = adjust(then, body, step.resource, step.by, levels, true);
  if (op.from === op.to) return [];
  const writer_group = holders.get(pool(op)) ?? holders.get(body) ?? group;
  if (!holders.has(body)) holders.set(body, writer_group);
  return [{ ...op, writer_group, at: then.state.clock }];
}

/** `holders` with each pool written so far and its writer group, for `pooled`. */
export function poolWriters(ops: readonly DeltaOp[], holders: Map<string, number>) {
  for (const o of ops) if (o.op === 'resource.adjust') holders.set(pool(o), o.writer_group);
  return holders;
}

/**
 * The ops paying `costs` in order from `entity`, and the levels after them; undefined when one
 * would take its resource below its minimum (21 §7 Cost: insufficient_resource, a rejection).
 */
export function pay(
  world: World,
  entity: EntityId,
  costs: readonly ActionCost[],
): { ops: Adjust[]; levels: Levels } | undefined {
  let levels: Levels = {};
  const ops: Adjust[] = [];
  for (const c of costs) {
    const paid = adjust(world, entity, c.resource, -c.amount, levels);
    if (paid.op.to < resourceSpec(world, entity, c.resource).minimum) return undefined;
    ops.push(paid.op);
    levels = paid.levels;
  }
  return { ops, levels };
}

/** The first of `costs` the entity cannot pay after the ones before it, named for the Book (pass-1 R1). */
export function shortfall(
  world: World,
  entity: EntityId,
  costs: readonly ActionCost[],
): Text | undefined {
  const c = costs.find((_, i) => !pay(world, entity, costs.slice(0, i + 1)));
  return (
    c && {
      key: 'resource.short' as TextKey,
      bindings: { resource: c.resource.key as TextKey, amount: c.amount },
    }
  );
}

/** `{ message }` naming the unpaid cost when `code` is insufficient_resource (pass-1 R1), else {}. */
export function unpaid(world: World, body: EntityId, code: unknown, costs: readonly ActionCost[]) {
  const message = code === 'insufficient_resource' && shortfall(world, body, costs);
  return message ? { message } : {};
}

/**
 * Exact conserved payment between two explicit, nonregenerating balance rows, from the values
 * `levels` left them in this decision (toolbox row 25 chains the deposit after the fee).
 */
export function transfer(
  world: World,
  from: EntityId,
  to: EntityId,
  resource: DefinitionRef,
  amount: number,
  levels: Levels = {},
): { ops: Adjust[]; levels: Levels } | undefined {
  const spec = resourceSpec(world, from, resource);
  const targetSpec = resourceSpec(world, to, resource);
  if (
    !spec ||
    !targetSpec ||
    spec.gain !== 0 ||
    spec.regen ||
    !Number.isSafeInteger(amount) ||
    amount <= 0
  )
    return;
  const source = world.state.resources?.[key({ kind: 'resource', resource, entity_id: from })];
  const destination = world.state.resources?.[key({ kind: 'resource', resource, entity_id: to })];
  if (
    !validOverrideRow(source, spec, world.state.clock) ||
    !validOverrideRow(destination, targetSpec, world.state.clock)
  )
    return;
  const out = adjust(world, from, resource, -amount, levels),
    into = adjust(world, to, resource, amount, out.levels);
  if (out.op.to < spec.minimum || into.op.to > targetSpec.maximum) return;
  return { ops: [out.op, into.op], levels: into.levels };
}

/** Zero-amount position adjustments in authored DefinitionRef order, including unchanged values. */
export function recoveryAdjustments(
  world: World,
  entity: EntityId,
  position: keyof ResourceRegen['by_position'],
): Adjust[] {
  return Object.entries(world.cartridge.resources ?? {})
    .sort(([a], [b]) => cmp(a, b))
    .flatMap(([, spec]) =>
      spec.regen
        ? [
            {
              ...adjust(world, entity, resourceRef(world, spec.key), 0, {}).op,
              next_rate: spec.regen.by_position[position],
            },
          ]
        : [],
    );
}

/** Final RPG agreement: only touched opted player pools, or all when position is written. */
export const recoveryFault = (world: World, ops?: readonly DeltaOp[]) =>
  admitted(world)
    .map(([actor, body]) => bodyFault(world, actor, body, ops))
    .find(Boolean);

function bodyFault(
  world: World,
  actor: CharacterId,
  body: EntityId,
  ops?: readonly DeltaOp[],
): MutationTarget | undefined {
  const positionWritten = ops?.some(
    (o) =>
      o.op === 'fact.assign' &&
      same(o.fact, fact(world)) &&
      o.scope.kind === 'player' &&
      o.scope.character_id === actor,
  );
  const touched = new Set(
    ops?.flatMap((o) =>
      o.op === 'resource.adjust' && o.entity_id === body ? [key(o.resource)] : [],
    ),
  );
  if (ops && !positionWritten && touched.size === 0) return undefined;
  for (const [, spec] of Object.entries(world.cartridge.resources ?? {}).sort(([a], [b]) =>
    cmp(a, b),
  )) {
    if (!spec.regen) continue;
    const resource = resourceRef(world, spec.key);
    if (ops && !positionWritten && !touched.has(key(resource))) continue;
    const target: MutationTarget = { kind: 'resource', resource, entity_id: body };
    const row = world.state.resources?.[key(target)];
    const value = level(world, body, resource);
    const position = positionOf(world, actor);
    const rate =
      typeof position === 'string'
        ? spec.regen.by_position[position as keyof typeof spec.regen.by_position]
        : undefined;
    if (rate === undefined || row?.rate !== rate || !Number.isFinite(value)) return target;
  }
}
