import React, { useMemo } from "react";
import { Canvas, Circle, Line, Group, vec } from "@shopify/react-native-skia";
import { colors } from "../../theme/colors";
import { useGameStore } from "../../store/gameStore";
import type { Direction } from "../../types/game";

const CANVAS_SIZE = 100;
const GRID_SPACING = 20;
const MAX_DEPTH = 2;
const RADIUS_CURRENT = 6;
const RADIUS_VISITED = 4.5;
const STROKE_WIDTH = 1.5;

const DIRECTION_OFFSETS: Record<Direction, [number, number]> = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0],
  up: [0, -1],
  down: [0, 1],
};

interface PlacedRoom {
  key: string;
  dx: number;
  dy: number;
  exits: Direction[];
}

function buildMinimapLayout(
  visitedRooms: Map<string, { exits: Direction[] }>,
  currentRoomKey: string | null,
): PlacedRoom[] {
  if (!currentRoomKey || !visitedRooms.has(currentRoomKey)) {
    return [];
  }

  const placed = new Map<string, PlacedRoom>();
  const queue: Array<{ key: string; dx: number; dy: number; depth: number }> =
    [{ key: currentRoomKey, dx: 0, dy: 0, depth: 0 }];

  placed.set(currentRoomKey, {
    key: currentRoomKey,
    dx: 0,
    dy: 0,
    exits: visitedRooms.get(currentRoomKey)?.exits ?? [],
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= MAX_DEPTH) continue;

    const roomData = visitedRooms.get(current.key);
    if (!roomData) continue;

    for (const exit of roomData.exits) {
      const offset = DIRECTION_OFFSETS[exit];
      if (!offset) continue;

      const [odx, ody] = offset;
      const neighborDx = current.dx + odx;
      const neighborDy = current.dy + ody;

      // Find the neighboring room key from the visited map.
      // We don't have a direct key lookup from (dx,dy), so we look for a
      // visited room that would be adjacent in the expected direction. Since
      // the game only tracks visited keys we match by checking if any
      // already-placed room sits at (neighborDx, neighborDy). If not, we
      // create a phantom entry only if we can infer a key.
      //
      // The visited map is keyed by room key, not by position. We can only
      // place a neighbor if we know its key. The store records exits on the
      // room that was visited but doesn't store destination keys per exit.
      // So we skip unknown neighbors — the minimap only renders rooms we
      // have actually visited and can position relative to the current room
      // by cross-referencing already-placed rooms.
      //
      // Strategy: use the position slot. If something is already placed at
      // (neighborDx, neighborDy) skip. Otherwise leave an empty slot — we
      // can only render rooms whose keys we know from the visited map. We
      // infer adjacency by checking all visited rooms for an exit in the
      // opposite direction back to current.

      const oppositeDir = getOppositeDirection(exit);

      // Check if any visited room "points back" to the current room via
      // the opposite direction, i.e. is a plausible neighbor.
      for (const [candidateKey, candidateData] of visitedRooms.entries()) {
        if (placed.has(candidateKey)) continue;
        if (!candidateData.exits.includes(oppositeDir)) continue;

        // Claim this slot.
        placed.set(candidateKey, {
          key: candidateKey,
          dx: neighborDx,
          dy: neighborDy,
          exits: candidateData.exits,
        });
        queue.push({
          key: candidateKey,
          dx: neighborDx,
          dy: neighborDy,
          depth: current.depth + 1,
        });
        break;
      }
    }
  }

  return Array.from(placed.values());
}

function getOppositeDirection(dir: Direction): Direction {
  const opposites: Record<Direction, Direction> = {
    north: "south",
    south: "north",
    east: "west",
    west: "east",
    up: "down",
    down: "up",
  };
  return opposites[dir];
}

interface Connection {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function buildConnections(rooms: PlacedRoom[]): Connection[] {
  const positionMap = new Map<string, PlacedRoom>();
  for (const room of rooms) {
    positionMap.set(`${room.dx},${room.dy}`, room);
  }

  const connections: Connection[] = [];
  const seen = new Set<string>();

  for (const room of rooms) {
    for (const exit of room.exits) {
      const offset = DIRECTION_OFFSETS[exit];
      if (!offset) continue;

      const [odx, ody] = offset;
      const neighborKey = `${room.dx + odx},${room.dy + ody}`;
      const neighbor = positionMap.get(neighborKey);
      if (!neighbor) continue;

      // Deduplicate bidirectional connections.
      const edgeKey =
        room.dx < neighbor.dx ||
        (room.dx === neighbor.dx && room.dy < neighbor.dy)
          ? `${room.dx},${room.dy}-${neighbor.dx},${neighbor.dy}`
          : `${neighbor.dx},${neighbor.dy}-${room.dx},${room.dy}`;

      if (seen.has(edgeKey)) continue;
      seen.add(edgeKey);

      const centerX = CANVAS_SIZE / 2;
      const centerY = CANVAS_SIZE / 2;

      connections.push({
        x1: centerX + room.dx * GRID_SPACING,
        y1: centerY + room.dy * GRID_SPACING,
        x2: centerX + neighbor.dx * GRID_SPACING,
        y2: centerY + neighbor.dy * GRID_SPACING,
      });
    }
  }

  return connections;
}

export function Minimap() {
  const { visitedRooms, room } = useGameStore();
  const currentRoomKey = room?.key ?? null;

  const { placedRooms, connections } = useMemo(() => {
    const placed = buildMinimapLayout(visitedRooms, currentRoomKey);
    const conns = buildConnections(placed);
    return { placedRooms: placed, connections: conns };
  }, [visitedRooms, currentRoomKey]);

  const centerX = CANVAS_SIZE / 2;
  const centerY = CANVAS_SIZE / 2;

  return (
    <Canvas style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
      <Group>
        {/* Connection lines */}
        {connections.map((conn, i) => (
          <Line
            key={`line-${i}`}
            p1={vec(conn.x1, conn.y1)}
            p2={vec(conn.x2, conn.y2)}
            color={colors.pathLine}
            strokeWidth={STROKE_WIDTH}
          />
        ))}

        {/* Room dots */}
        {placedRooms.map((placedRoom) => {
          const isCurrent = placedRoom.key === currentRoomKey;
          const cx = centerX + placedRoom.dx * GRID_SPACING;
          const cy = centerY + placedRoom.dy * GRID_SPACING;

          return (
            <Circle
              key={placedRoom.key}
              cx={cx}
              cy={cy}
              r={isCurrent ? RADIUS_CURRENT : RADIUS_VISITED}
              color={isCurrent ? colors.dotCurrent : colors.dotVisited}
            />
          );
        })}
      </Group>
    </Canvas>
  );
}
