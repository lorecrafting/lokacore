// A death's authored lines outside the combat round's own (loka-3w3q).
import type { CharacterId, DeltaOp, DomainEvent, Text } from '../../contracts.gen.ts';
import type { World } from '../../runtime/decision.ts';
import { levelUp } from '../levelling/shared.ts';

/** A player's fall line outside a combat round: the death's own, else combat's. */
export function fallLine(world: World): Text[] {
  const w = world.cartridge.world;
  const key = w?.death?.narration?.player_died ?? w?.combat?.narration.player_died;
  return key ? [{ key }] : [];
}

/** A receipt's lines, then its penalty and waking lines, cut to DecisionResult's 64 lines. */
export function closing(
  world: World,
  actor: CharacterId,
  ops: readonly DeltaOp[],
  events: DomainEvent[],
  narration: Text[],
): Text[] {
  const last = [...levelUp(world, actor, ops), ...woke(world, events)];
  return [...narration.slice(0, 64 - last.length), ...last];
}

/** Once after any player's death (an NPC victim carries its definition), combat included. */
function woke(world: World, events: DomainEvent[]): Text[] {
  const key = world.cartridge.world?.death?.narration?.woke;
  const died = events.some((e) => e.payload.type === 'entity_died' && !e.payload.victim_definition);
  return key && died ? [{ key }] : [];
}
