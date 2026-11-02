// A death's authored lines outside the combat round's own (loka-3w3q).
import type { CharacterId, DeltaOp, DomainEvent, Text } from '../../contracts.gen.ts';
import type { World } from '../../runtime/decision.ts';
import { levelUp } from '../levelling/shared.ts';
import { triggered } from '../reaction.ts';

/** A player's fall line outside a combat round: the death's own, else combat's. */
export function fallLine(world: World): Text[] {
  const w = world.cartridge.world;
  const key = w?.death?.narration?.player_died ?? w?.combat?.narration.player_died;
  return key ? [{ key }] : [];
}

/**
 * A receipt's lines with its level (or penalty) lines at `at`, before a level_reached rule's own,
 * then its waking line, cut to DecisionResult's 64 lines.
 */
export function closing(
  world: World,
  actor: CharacterId,
  ops: readonly DeltaOp[],
  events: DomainEvent[],
  narration: Text[],
  at = narration.length,
): Text[] {
  const level = levelUp(world, actor, ops);
  const end = woke(world, events);
  const kept = narration.slice(0, 64 - level.length - end.length);
  // A penalty line (no level line) stays after the death's own lines.
  const i = level.some((l) => l.key === world.cartridge.world?.levelling?.level_up)
    ? at
    : kept.length;
  return [...kept.slice(0, i), ...level, ...kept.slice(i), ...end];
}

/** Where the actor's level lines go: before the lines of a level_reached its rules answer, at `length`. */
export function levelAt(world: World, actor: CharacterId, cause: DomainEvent, length: number) {
  const { payload } = cause;
  if (payload.type !== 'level_reached' || payload.character_id !== actor) return;
  return triggered(world, cause).length ? length : undefined;
}

/** Once after any player's death (an NPC victim carries its definition), combat included. */
function woke(world: World, events: DomainEvent[]): Text[] {
  const key = world.cartridge.world?.death?.narration?.woke;
  const died = events.some((e) => e.payload.type === 'entity_died' && !e.payload.victim_definition);
  return key && died ? [{ key }] : [];
}
