import { present } from '../commands/target.ts';
import type { EntityId, GameView, Key } from '../contracts.gen.ts';
import { COMPASS, refString, type Steps, type World } from '../runtime/decision.ts';
import { exitOf } from '../mechanics/lookups.ts';
import { hidden } from '../mechanics/movement/shared.ts';
import { cmp } from '../foundation/validate.ts';
import { refusal, resolved } from '../commands/actions.ts';

export function knowledgeView(
  world: World,
  steps: Steps = { n: 0 },
): Pick<GameView, 'map' | 'known_npcs'> {
  if (!world.cartridge.map_positions) return {};
  const visited = new Set(
    Object.values(world.state.visited_rooms ?? {})
      .filter((r) => r.actor_id === world.character)
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
      return to && visited.has(to) && !hidden(world, world.rooms[id], direction, world.character)
        ? [{ from: id, to, direction }]
        : [];
    }),
  );
  return {
    map: { rooms, links },
    ...(resolved(world, world.character).where && { known_npcs: knownNpcs(world, steps) }),
  };
}

function knownNpcs(world: World, steps: Steps) {
  const ids = new Set(
    Object.values(world.state.observed_npcs ?? {})
      .filter((r) => r.actor_id === world.character)
      .map((r) => r.npc_id),
  );
  for (const [id, entity] of Object.entries(world.entities))
    if (
      entity.kind === 'npc' &&
      world.state.containers[id] === world.state.containers[world.body] &&
      present(world, world.character, id, steps)
    )
      ids.add(id as EntityId);
  return [...ids]
    .filter(
      (target_id) =>
        !refusal(
          world,
          { type: 'where', actor_id: world.character, target_id },
          steps,
          'where' as Key,
        ),
    )
    .sort(cmp)
    .map((id) => ({ id, name: world.entities[id].short }));
}
