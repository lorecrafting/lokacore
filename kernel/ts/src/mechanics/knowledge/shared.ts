import type { CharacterId, DeltaOp, EntityId } from '../../contracts.gen.ts';
import { key, same } from '../../foundation/compose.ts';
import { present } from '../../commands/target.ts';
import { bodyOf, type Steps, type World } from '../../runtime/decision.ts';

/** Accepted entry and Look share the same visible-NPC observation owner. */
export function record(
  world: World,
  actor_id: CharacterId,
  entry: boolean,
  steps: Steps,
  target_id?: EntityId,
): DeltaOp[] {
  if (!world.cartridge.lock.capabilities.knowledge) return [];
  const body = bodyOf(world, actor_id);
  if (!body) return [];
  const room_id = world.state.containers[body];
  if (!world.rooms[room_id]) return [];
  const ops = entry ? visit(world, actor_id, room_id) : [];
  for (const [id, npc] of Object.entries(world.entities)) {
    if (
      npc.kind !== 'npc' ||
      world.state.containers[id] !== room_id ||
      (target_id !== undefined && id !== target_id) ||
      !present(world, actor_id, id, steps)
    )
      continue;
    const npc_id = id as EntityId;
    const from =
      world.state.observed_npcs?.[key({ kind: 'observation', actor_id, npc_id })] ?? null;
    const value = { actor_id, npc_id, room_id, at: world.state.clock };
    if (!same(from, value))
      ops.push({ op: 'observation.record', writer_group: 0, actor_id, npc_id, from, value });
  }
  return ops;
}

// A first entry records the room; with variety@1 each later one counts it (VisitedRoom.count).
function visit(world: World, actor_id: CharacterId, room_id: EntityId): DeltaOp[] {
  const from = visitRow(world, actor_id, room_id);
  const op = { op: 'visit.record', writer_group: 0, actor_id, room_id } as const;
  if (!from) return [{ ...op, value: { actor_id, room_id } }];
  if (!world.cartridge.lock.capabilities.variety) return [];
  return [{ ...op, from, value: { actor_id, room_id, count: (from.count ?? 1) + 1 } }];
}

/**
 * Knowledge is one writer after causal mechanics. A same-command reaction or policy reading
 * visited_count sees the proposal with the entry already recorded (the current entry included);
 * only the writer group moves last.
 */
export function knowledgeLast(ops: readonly DeltaOp[]): readonly DeltaOp[] {
  const isKnowledge = (op: DeltaOp) => op.op === 'visit.record' || op.op === 'observation.record';
  const writes = ops.filter(isKnowledge);
  if (!writes.length) return ops;
  const writer_group = Math.max(0, ...ops.map((op) => op.writer_group)) + 1;
  return [
    ...ops.filter((op) => !isKnowledge(op)),
    ...writes.map((op) => ({ ...op, writer_group })),
  ];
}

/** Exact body transfers include ferry, surface, Flee and death return without UI special cases. */
export function enteredActors(world: World, ops: readonly DeltaOp[]): Set<CharacterId> {
  const actors = new Set<CharacterId>();
  for (const op of ops) {
    if (op.op !== 'entity.transfer' || !world.rooms[op.destination_id]) continue;
    const actor = world.knownEntities[op.entity_id]?.owner_id;
    if (actor && bodyOf(world, actor) === op.entity_id) actors.add(actor);
  }
  return actors;
}

/** The actor's accepted entries into `room` (0 before the first; a row without count is 1). */
export const visits = (world: World, actor_id: CharacterId, room_id: EntityId): number => {
  const row = visitRow(world, actor_id, room_id);
  return row ? (row.count ?? 1) : 0;
};

const visitRow = (world: World, actor_id: CharacterId, room_id: EntityId) =>
  world.state.visited_rooms?.[key({ kind: 'visit', actor_id, room_id })];

export const observation = (world: World, actor: CharacterId, npc: EntityId) =>
  world.state.observed_npcs?.[key({ kind: 'observation', actor_id: actor, npc_id: npc })];

export function locate(world: World, actor: CharacterId, target: EntityId, steps: Steps) {
  if (world.entities[target]?.kind === 'npc' && present(world, actor, target, steps))
    return { target_id: target, status: 'here' as const, room_id: world.state.containers[target] };
  const seen = observation(world, actor, target);
  return seen
    ? { target_id: target, status: 'last_seen' as const, room_id: seen.room_id, at: seen.at }
    : { target_id: target, status: 'unknown' as const };
}
