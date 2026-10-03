// Read-only lookups over a World shared by rules and the GameView: a room's exits, a barrier's
// state and an actor's quest instance. Split from decision.ts (c1-equipment).
import type {
  BarrierState,
  CharacterId,
  Connection,
  DefinitionRef,
  QuestInstanceId,
  RoomDefinition,
  StateScope,
} from './contracts.gen.ts';
import { key } from './compose.ts';
import type { QuestRow, World } from './decision.ts';

/** The room's exit in a direction, if it has one. */
export const exitOf = (room: RoomDefinition, direction: string): Connection | undefined =>
  (room.exits as Readonly<Record<string, Connection>>)[direction];

/** The room a direction's exit leads to, if the room has that exit. */
export const exitTo = (room: RoomDefinition, direction: string): DefinitionRef | undefined =>
  exitOf(room, direction)?.to;

/** A barrier's current state (barrier@1): its stored state, else its initial one. */
export const barrierState = (world: World, barrier: DefinitionRef): BarrierState =>
  world.state.barriers?.[key({ kind: 'barrier', barrier })] ?? world.barrierInitial[key(barrier)];

/**
 * `actor`'s instance of `quest` (player scope, 06 §2), if it has one: its id and row. One per
 * quest and actor, since the offer is withdrawn once one exists (actions.ts).
 */
export function questOf(
  world: World,
  actor: CharacterId,
  quest: DefinitionRef,
): [QuestInstanceId, QuestRow] | undefined {
  const scope: StateScope = { kind: 'player', character_id: actor };
  return Object.entries(world.state.quests ?? {}).find(
    ([, q]) => key(q.quest) === key(quest) && key(q.scope) === key(scope),
  ) as [QuestInstanceId, QuestRow] | undefined;
}
