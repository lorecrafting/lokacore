// status@1 status reader 4 (loka-x6t.30): which Command types a body's active statuses bar.
import type { EntityId, Key } from '../../contracts.gen.ts';
import type { World } from '../../runtime/decision.ts';
import { activeStatuses } from './shared.ts';

/**
 * Status reader 4: whether `body`'s active statuses let it take Command type `command`: none blocks
 * it and every `allows` list names it. The player's admission (`permits`) and NPC combat turns read it.
 */
export function statusAllows(world: World, body: EntityId) {
  const bar = barring(world, body);
  return (command: string) => !bar(command);
}

/** The first active status on `body` (definition order) that bars Command type `command`, if any. */
export function barring(world: World, body: EntityId) {
  const bars = Object.values(world.cartridge.statuses ?? {}).some((s) => s.blocks || s.allows);
  const specs = bars ? activeStatuses(world, body).map(({ spec }) => spec) : [];
  return (command: string) =>
    specs.find(
      (s) => s.blocks?.includes(command as Key) || !(s.allows?.includes(command as Key) ?? true),
    );
}

/** Status reader 4: whether NPC `npc` may move (its statuses bar or leave out `move`); every NPC mover reads it. */
export const moves = (world: World, npc: EntityId) => statusAllows(world, npc)('move');
