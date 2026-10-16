import type { DefinitionRef, EntityId } from '../../contracts.gen.ts';
import { key } from '../../foundation/compose.ts';
import type { World } from '../../runtime/decision.ts';

export const planRef = (world: World, key: string): DefinitionRef => ({
  cartridge_id: world.cartridge.manifest.id,
  cartridge_version: world.cartridge.manifest.version,
  kind: 'population',
  key: key as DefinitionRef['key'],
});

/** The plan's living members (row W12's population_count): a dead member keeps its id with
 * replacement_due set; a slot row not yet written counts 0. */
export const livingCount = (world: World, plan: DefinitionRef): number =>
  livingMembers(world, plan).length;

/** The ids of those living members, in slot order (Settle S4-1's plan move sorts them). */
export function livingMembers(world: World, plan: DefinitionRef): EntityId[] {
  const ids: EntityId[] = [];
  for (let slot = 1; slot <= world.populationSpecs[key(plan)]!.cap; slot++) {
    const row = world.state.population_slots?.[key({ kind: 'population_slot', plan, slot })];
    if (row?.member_id && row.replacement_due === null) ids.push(row.member_id);
  }
  return ids;
}
