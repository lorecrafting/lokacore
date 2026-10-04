// Shared position@1 queries and verb mapping (mechanics.md position@1). Rules import kernel
// helpers; movement never depends on the position rule module.
import type { CharacterId, DefinitionRef, FactValue } from '../../contracts.gen.ts';
import { has, type World } from '../../runtime/decision.ts';
import { value } from '../fact.ts';

/** Each position@1 command, its position and its outcome. */
export const VERBS: Readonly<Record<string, [string, string]>> = {
  stand: ['standing', 'stood'],
  sit: ['sitting', 'sat'],
  rest: ['resting', 'rested'],
  sleep: ['sleeping', 'slept'],
};

export const fact = (world: World): DefinitionRef => {
  const { id: cartridge_id, version: cartridge_version } = world.cartridge.manifest;
  return { cartridge_id, cartridge_version, kind: 'fact', key: 'position' };
};

/** `actor`'s position, or undefined when the cartridge does not lock position@1. */
export const positionOf = (world: World, actor: CharacterId): FactValue | undefined =>
  has(world.cartridge.lock.capabilities, 'position') ? value(world, actor, fact(world)) : undefined;

/** False when `actor` must stand first (position@1, not standing); shared with the GameView. */
export const standing = (world: World, actor: CharacterId) =>
  (positionOf(world, actor) ?? 'standing') === 'standing';
