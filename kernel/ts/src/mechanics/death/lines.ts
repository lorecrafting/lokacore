// A death's authored lines outside the combat round's own (loka-3w3q).
import type { DomainEvent, Text } from '../../contracts.gen.ts';
import type { World } from '../../runtime/decision.ts';

/** A player's fall line outside a combat round: the death's own, else combat's. */
export function fallLine(world: World): Text[] {
  const w = world.cartridge.world;
  const key = w?.death?.narration?.player_died ?? w?.combat?.narration.player_died;
  return key ? [{ key }] : [];
}

/** Once after any player's death (an NPC victim carries its definition), combat included. */
export function woke(world: World, events: DomainEvent[]): Text[] {
  const key = world.cartridge.world?.death?.narration?.woke;
  const died = events.some((e) => e.payload.type === 'entity_died' && !e.payload.victim_definition);
  return key && died ? [{ key }] : [];
}
