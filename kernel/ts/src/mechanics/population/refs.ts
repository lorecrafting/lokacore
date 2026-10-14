import type { DefinitionRef } from '../../contracts.gen.ts';
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
export function livingCount(world: World, plan: DefinitionRef): number {
  let n = 0;
  for (let slot = 1; slot <= world.populationSpecs[key(plan)]!.cap; slot++) {
    const row = world.state.population_slots?.[key({ kind: 'population_slot', plan, slot })];
    if (row?.member_id && row.replacement_due === null) n++;
  }
  return n;
}
