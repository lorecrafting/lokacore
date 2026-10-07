import type { GameView, Key } from '../contracts.gen.ts';
import { COMPASS, refString, type Steps, type World } from '../runtime/decision.ts';
import { exitOf } from '../mechanics/lookups.ts';
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
      return to && visited.has(to) ? [{ from: id, to, direction }] : [];
    }),
  );
  const known_npcs = Object.values(world.state.observed_npcs ?? {})
    .filter(
      (r) =>
        r.actor_id === world.character &&
        !refusal(
          world,
          { type: 'where', actor_id: world.character, target_id: r.npc_id },
          steps,
          'where' as Key,
        ),
    )
    .sort((a, b) => cmp(a.npc_id, b.npc_id))
    .map((r) => ({ id: r.npc_id, name: world.entities[r.npc_id].short }));
  return { map: { rooms, links }, ...(resolved(world, world.character).where && { known_npcs }) };
}
