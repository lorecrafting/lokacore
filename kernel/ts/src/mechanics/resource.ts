// resource@1: pure resource queries and exact adjustments. Legacy gain crosses hour
// boundaries; opted recovery settles the old stored position rate and fractional credit.
import { capped, validOverrideRow } from '../foundation/resource.ts';
import { current, key, same } from '../foundation/compose.ts';
import type {
  DefinitionRef,
  DeltaOp,
  EntityId,
  Key,
  MutationTarget,
  RecipeCost,
  ResourceRegen,
} from '../contracts.gen.ts';
import type { World } from '../runtime/decision.ts';
import { add, saturate } from '../foundation/int.ts';
import { fact, positionOf } from './position/shared.ts';
import { cmp } from '../foundation/validate.ts';
import { derived } from './attributes/shared.ts';

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
 * The player body's pool maxima moved by the derived hp_max table (mechanics.md resource@1), by
 * canonical resource target; composition reads the same map (runtime/apply.ts base).
 */
export function maxima(world: World): Readonly<Record<string, number>> {
  const table = world.cartridge.world?.derived?.hp_max;
  const hp = resourceRef(world, 'hp');
  const at = key({ kind: 'resource', resource: hp, entity_id: world.body });
  const spec = world.resourceSpecs[key(hp)];
  if (!table || !spec || world.entityResourceSpecs[at]) return {};
  const maximum = saturate(spec.maximum + derived(world, world.character, table));
  return { [at]: Math.max(spec.minimum, maximum) };
}

/** Effective definition for this exact resource target, falling back to the pool. */
export function resourceSpec(world: World, entity: EntityId, resource: DefinitionRef) {
  const at = key({ kind: 'resource', resource, entity_id: entity });
  const spec = world.entityResourceSpecs[at] ?? world.resourceSpecs[key(resource)];
  const maximum = entity === world.body && spec ? maxima(world)[at] : undefined;
  return maximum === undefined ? spec : { ...spec, maximum };
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
 * recipe step, RecipeStep: add by, stopping at the bounds) stops the result at the resource's
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

/**
 * The ops paying `costs` in order from `entity`, and the levels after them; undefined when one
 * would take its resource below its minimum (21 §7 Cost: insufficient_resource, a rejection).
 */
export function pay(
  world: World,
  entity: EntityId,
  costs: readonly RecipeCost[],
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

/** Exact conserved payment between two explicit, nonregenerating balance rows. */
export function transfer(
  world: World,
  from: EntityId,
  to: EntityId,
  resource: DefinitionRef,
  amount: number,
): { ops: Adjust[] } | undefined {
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
    !validOverrideRow(destination, targetSpec, world.state.clock) ||
    source.value - amount < spec.minimum ||
    destination.value + amount > targetSpec.maximum
  )
    return;
  return {
    ops: [
      adjust(world, from, resource, -amount, {}).op,
      adjust(world, to, resource, amount, {}).op,
    ],
  };
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
export function recoveryFault(world: World, ops?: readonly DeltaOp[]): MutationTarget | undefined {
  const positionWritten = ops?.some(
    (o) =>
      o.op === 'fact.assign' &&
      same(o.fact, fact(world)) &&
      o.scope.kind === 'player' &&
      o.scope.character_id === world.character,
  );
  const touched = new Set(
    ops?.flatMap((o) =>
      o.op === 'resource.adjust' && o.entity_id === world.body ? [key(o.resource)] : [],
    ),
  );
  if (ops && !positionWritten && touched.size === 0) return undefined;
  for (const [, spec] of Object.entries(world.cartridge.resources ?? {}).sort(([a], [b]) =>
    cmp(a, b),
  )) {
    if (!spec.regen) continue;
    const resource = resourceRef(world, spec.key);
    if (ops && !positionWritten && !touched.has(key(resource))) continue;
    const target: MutationTarget = { kind: 'resource', resource, entity_id: world.body };
    const row = world.state.resources?.[key(target)];
    const value = level(world, world.body, resource);
    const position = positionOf(world, world.character);
    const rate =
      typeof position === 'string'
        ? spec.regen.by_position[position as keyof typeof spec.regen.by_position]
        : undefined;
    if (rate === undefined || row?.rate !== rate || !Number.isFinite(value)) return target;
  }
}
