import { present } from '../commands/target.ts';
import type { CharacterId, EntityId, GameView, Key } from '../contracts.gen.ts';
import {
  bodyOf,
  COMPASS,
  refString,
  type Cartridge,
  type Steps,
  type World,
} from '../runtime/decision.ts';
import { exitOf, hidden } from '../mechanics/lookups.ts';
import { cmp } from '../foundation/validate.ts';
import { living } from '../mechanics/death/shared.ts';
import { refusal, resolved } from '../commands/actions.ts';
import { describeEntity, displayedName } from '../mechanics/description_variant/rule.ts';

const STEP: Record<string, [number, number, number]> = {
  north: [0, -1, 0],
  south: [0, 1, 0],
  east: [1, 0, 0],
  west: [-1, 0, 0],
  up: [0, 0, 1],
  down: [0, 0, -1],
};

// Built rooms S2: a built room sits one unit from its site in its direction (north is -y).
function positions(world: World, authored: NonNullable<Cartridge['layout']>) {
  const at = new Map(authored.map((p) => [world.roomIds[refString(p.room)], p]));
  for (const [id, { origin }] of Object.entries(world.state.created ?? {})) {
    if (origin.kind !== 'built' || world.state.built?.[id]) continue; // a razed room leaves the map (S5)
    const site = at.get(world.roomIds[refString(origin.site)]);
    if (!site) continue;
    const [dx, dy, dz] = STEP[origin.direction];
    at.set(id as EntityId, { ...site, x: site.x + dx, y: site.y + dy, z: site.z + dz });
  }
  return at;
}

export function knowledgeView(
  world: World,
  actor: CharacterId,
  steps: Steps = { n: 0 },
): Pick<GameView, 'map' | 'known_npcs' | 'actor_name'> {
  const actor_name = displayedName(world, actor, steps);
  const name = actor_name && { actor_name };
  if (!world.cartridge.layout) return { ...name };
  const visited = new Set(
    Object.values(world.state.visited_rooms ?? {})
      .filter((r) => r.actor_id === actor)
      .map((r) => r.room_id),
  );
  const at = positions(world, world.cartridge.layout);
  const rooms = [...at]
    .flatMap(([id, p]) =>
      visited.has(id) ? [{ id, title: world.rooms[id].name, x: p.x, y: p.y, z: p.z }] : [],
    )
    .sort((a, b) => cmp(a.id, b.id));
  const links = rooms.flatMap(({ id }) =>
    COMPASS.flatMap((direction) => {
      const exit = exitOf(world.rooms[id], direction);
      const to = exit && world.roomIds[refString(exit.to)];
      return to &&
        visited.has(to) &&
        at.has(to) &&
        !hidden(world, world.rooms[id], direction, actor)
        ? [{ from: id, to, direction }]
        : [];
    }),
  );
  return {
    ...name,
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
        living(world, target_id) && // book-ui.md Where: only a living known NPC (pass-1 UF3)
        !refusal(world, { type: 'where', actor_id: actor, target_id }, steps, 'where' as Key),
    )
    .sort(cmp)
    .map((id) => ({ id, name: describeEntity(world, actor, id, 'short', steps) }));
}
