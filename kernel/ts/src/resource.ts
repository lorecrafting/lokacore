// resource@1 (21 §4 Resource; resource.schema.json ResourceSpec): a body's current resource
// values, derived from the stored row and the clock (compose.ts current: regeneration by hour
// boundary, stopping at maximum), and the resource.adjust ops that pay costs and apply steps.
// resource@1 emits no events and owns no command, so no rule: movement and action_recipe call
// this. ponytail: regeneration has no position bonus or hunger penalty yet (00 §4.2); those join
// with positions (R7) and needs (R8) as extra gain terms here.
import { current, key } from './compose.ts';
import type { DefinitionRef, DeltaOp, EntityId, Key, RecipeCost } from './contracts.gen.ts';
import type { World } from './decision.ts';
import { add } from './int.ts';

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

/** `entity`'s current value of `resource` at the world's clock; undefined if undeclared. */
export function level(world: World, entity: EntityId, resource: DefinitionRef): number | undefined {
  const spec = world.resourceSpecs[key(resource)];
  if (!spec) return undefined;
  const row = world.state.resources?.[key({ kind: 'resource', resource, entity_id: entity })];
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
  const { minimum, maximum } = world.resourceSpecs[key(resource)];
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
    if (paid.op.to < world.resourceSpecs[key(c.resource)].minimum) return undefined;
    ops.push(paid.op);
    levels = paid.levels;
  }
  return { ops, levels };
}
