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

/**
 * A receipt's lines with its level lines at `levelAt` (see `say`), and its penalty line then its
 * waking line at `wokeAt`, before the death's reaction lines (loka-kgd.206), cut to DecisionResult's
 * 64 lines.
 */
export function closing(
  world: World,
  actor: CharacterId,
  ops: readonly DeltaOp[],
  p: { events: DomainEvent[]; narration: Text[]; levelAt?: number; wokeAt?: number },
): Text[] {
  const { events, narration, levelAt: at = narration.length, wokeAt = narration.length } = p;
  const level = levelUp(world, actor, ops);
  const end = woke(world, events);
  const kept = narration.slice(0, 64 - level.length - end.length);
  const w = Math.min(wokeAt, kept.length);
  // A penalty line (no level line) stays after the death's own lines, before its waking line.
  const i = level.some((l) => l.key === world.cartridge.world?.levelling?.level_up) ? at : w;
  const lines = [...kept];
  lines.splice(w, 0, ...end);
  lines.splice(i <= w ? i : i + end.length, 0, ...level);
  return lines;
}

/** Adds a reaction's lines; the actor's level lines go before the first a rule answering its level_reached says. */
export function say(
  p: { narration: Text[]; levelAt?: number },
  actor: CharacterId,
  cause: DomainEvent,
  lines: readonly Text[] = [],
) {
  const { payload } = cause;
  if (lines.length && payload.type === 'level_reached' && payload.character_id === actor)
    p.levelAt ??= p.narration.length;
  p.narration.push(...lines);
}

/** Once after any player's death (an NPC victim carries its definition), combat included. */
function woke(world: World, events: DomainEvent[]): Text[] {
  const key = world.cartridge.world?.death?.narration?.woke;
  const died = events.some((e) => e.payload.type === 'entity_died' && !e.payload.victim_definition);
  return key && died ? [{ key }] : [];
}
