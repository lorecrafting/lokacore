import { present } from '../commands/target.ts';
import type { CharacterId, EntityId, GameView, Key } from '../contracts.gen.ts';
import { bodyOf, COMPASS, refString, type Steps, type World } from '../runtime/decision.ts';
import { exitOf, hidden } from '../mechanics/lookups.ts';
import { cmp } from '../foundation/validate.ts';
import { refusal, resolved } from '../commands/actions.ts';

export function knowledgeView(
  world: World,
  actor: CharacterId,
  steps: Steps = { n: 0 },
): Pick<GameView, 'map' | 'known_npcs'> {
  if (!world.cartridge.map_positions) return {};
  const visited = new Set(
    Object.values(world.state.visited_rooms ?? {})
      .filter((r) => r.actor_id === actor)
      .map((r) => r.room_id),
  );
  const rooms = world.cartridge.map_positions
    .flatMap((p) => {
      const id = world.roomIds[refString(p.room)];
      return visited.has(id) ? [{ id, title: world.rooms[id].title, x: p.x, y: p.y, z: p.z }] : [];
    })
    .sort((a, b) => cmp(a.id, b.id));
  const links = rooms.flatMap(({ id }) =>
    COMPASS.flatMap((direction) => {
      const exit = exitOf(world.rooms[id], direction);
      const to = exit && world.roomIds[refString(exit.to)];
      return to && visited.has(to) && !hidden(world, world.rooms[id], direction, actor)
        ? [{ from: id, to, direction }]
        : [];
    }),
  );
  return {
    map: { rooms, links },
    ...(resolved(world, actor).where && { known_npcs: knownNpcs(world, actor, steps) }),
  };
}

function knownNpcs(world: World, actor: CharacterId, steps: Steps) {
  const body = bodyOf(world, actor);
  const ids = new Set(
    Object.values(world.state.observed_npcs ?? {})
      .filter((r) => r.actor_id === actor)
      .map((r) => r.npc_id),
  );
  for (const [id, entity] of Object.entries(world.entities))
    if (
      entity.kind === 'npc' &&
      body !== undefined &&
      world.state.containers[id] === world.state.containers[body] &&
      present(world, actor, id, steps)
    )
      ids.add(id as EntityId);
  return [...ids]
    .filter(
      (target_id) =>
        !refusal(world, { type: 'where', actor_id: actor, target_id }, steps, 'where' as Key),
    )
    .sort(cmp)
    .map((id) => ({ id, name: world.entities[id].short }));
}
