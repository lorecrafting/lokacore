// resource@1: pure resource queries and exact adjustments. Legacy gain crosses hour
// boundaries; opted recovery settles the old stored position rate and fractional credit.
import { validOverrideRow } from '../foundation/resource.ts';
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
import { add } from '../foundation/int.ts';
import { fact, positionOf } from './position/shared.ts';
import { cmp } from '../foundation/validate.ts';

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

/** Effective definition for this exact resource target, falling back to the pool. */
export const resourceSpec = (world: World, entity: EntityId, resource: DefinitionRef) =>
  world.entityResourceSpecs[key({ kind: 'resource', resource, entity_id: entity })] ??
  world.resourceSpecs[key(resource)];

/** `entity`'s current value of `resource` at the world's clock; undefined if undeclared. */
export function level(world: World, entity: EntityId, resource: DefinitionRef): number | undefined {
  const spec = resourceSpec(world, entity, resource);
  if (!spec) return undefined;
  const row = world.state.resources?.[key({ kind: 'resource', resource, entity_id: entity })];
  const override =
    world.entityResourceSpecs[key({ kind: 'resource', resource, entity_id: entity })];
  if (override && !validOverrideRow(row, override, world.state.clock)) return undefined;
  return current(row, spec, world.state.clock);
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
    const position = positionOf(world, world.character);
    const rate =
      typeof position === 'string'
        ? spec.regen.by_position[position as keyof typeof spec.regen.by_position]
        : undefined;
    if (
      rate === undefined ||
      row?.rate !== rate ||
      !Number.isFinite(current(row, spec, world.state.clock))
    )
      return target;
  }
}
