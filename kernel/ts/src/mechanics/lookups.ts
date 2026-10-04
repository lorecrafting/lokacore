// Read-only lookups over a World shared by rules and the GameView: a room's exits, a barrier's
// state, custody (what is in reach) and an actor's quest instance. Split from runtime/decision.ts (c1-equipment).
import type {
  BarrierState,
  CharacterId,
  Connection,
  DefinitionRef,
  EntityId,
  QuestInstanceId,
  RoomDefinition,
  StateScope,
} from '../contracts.gen.ts';
import { LIMITS } from '../contracts.gen.ts';
import { key } from '../foundation/compose.ts';
import { has, type QuestRow, type Steps, type World } from '../runtime/decision.ts';

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
 * Custody (mechanics.md containment@1, c1-locks): true when the walk up State.containers from
 * `id` reaches `body` or its room through open containers only (`opened`), so an NPC, a slot
 * holder or a closed or locked lid on the way fails it.
 */
export function reach(world: World, body: EntityId, id: EntityId, steps: Steps = { n: 0 }) {
  const room = world.state.containers[body];
  const seen = new Set<string>();
  let at: string = id;
  while (true) {
    if (seen.has(at)) return 'containment_cycle' as const;
    if (++steps.n > LIMITS.query_steps) return 'budget_exceeded' as const;
    seen.add(at);
    const parent = world.state.containers[at];
    if (parent === body || parent === room) return true;
    if (!opened(world, parent)) return false;
    at = parent;
  }
}

/** True when `id` is an item whose contents are in reach: no barrier, or an open one. */
export function opened(world: World, id: string): boolean {
  const e = has(world.entities, id) ? world.entities[id] : undefined;
  return e?.kind === 'item' && (!e.barrier || barrierState(world, e.barrier) === 'open');
}

/**
 * `actor`'s instance of `quest` (player scope, 06 §2), if it has one: its id and row. One per
 * quest and actor, since the offer is withdrawn once one exists (commands/actions.ts).
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
