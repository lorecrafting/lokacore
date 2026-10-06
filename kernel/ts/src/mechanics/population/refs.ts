import type { DefinitionRef } from '../../contracts.gen.ts';
import type { World } from '../../runtime/decision.ts';

export const planRef = (world: World, key: string): DefinitionRef => ({
  cartridge_id: world.cartridge.manifest.id,
  cartridge_version: world.cartridge.manifest.version,
  kind: 'population',
  key: key as DefinitionRef['key'],
});
