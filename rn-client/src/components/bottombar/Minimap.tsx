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
const RADIUS_KNOWN = 3;
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
  visited: boolean;
}

function buildMinimapLayout(
  visitedRooms: Map<string, { exits: Direction[]; destinations: Partial<Record<Direction, string>> }>,
  currentRoomKey: string | null,
): PlacedRoom[] {
  if (!currentRoomKey) return [];

  const placed = new Map<string, PlacedRoom>();
  const queue: Array<{ key: string; dx: number; dy: number; depth: number }> = [
    { key: currentRoomKey, dx: 0, dy: 0, depth: 0 },
  ];

  const currentData = visitedRooms.get(currentRoomKey);
  placed.set(currentRoomKey, {
    key: currentRoomKey,
    dx: 0,
    dy: 0,
    exits: currentData?.exits ?? [],
    visited: true,
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= MAX_DEPTH) continue;

    const roomData = visitedRooms.get(current.key);
    if (!roomData) continue;

    for (const exit of roomData.exits) {
      const destKey = roomData.destinations[exit];
      if (!destKey || placed.has(destKey)) continue;

      const offset = DIRECTION_OFFSETS[exit];
      if (!offset) continue;

      const [odx, ody] = offset;
      const neighborDx = current.dx + odx;
      const neighborDy = current.dy + ody;
      const neighborData = visitedRooms.get(destKey);

      placed.set(destKey, {
        key: destKey,
        dx: neighborDx,
        dy: neighborDy,
        exits: neighborData?.exits ?? [],
        visited: !!neighborData,
      });

      if (neighborData) {
        queue.push({ key: destKey, dx: neighborDx, dy: neighborDy, depth: current.depth + 1 });
      }
    }
  }

  // Phantom pass: for every exit of every placed room, if the exit position
  // has no room yet, add a ghost dot there. This shows unvisited rooms whose
  // key we don't know yet, based purely on the exit direction.
  const occupiedPositions = new Set<string>(
    Array.from(placed.values()).map((r) => `${r.dx},${r.dy}`),
  );
  for (const room of Array.from(placed.values())) {
    for (const exit of room.exits) {
      const offset = DIRECTION_OFFSETS[exit];
      if (!offset) continue;
      const [odx, ody] = offset;
      const phantomDx = room.dx + odx;
      const phantomDy = room.dy + ody;
      const posKey = `${phantomDx},${phantomDy}`;
      if (!occupiedPositions.has(posKey)) {
        placed.set(`phantom:${posKey}`, {
          key: `phantom:${posKey}`,
          dx: phantomDx,
          dy: phantomDy,
          exits: [],
          visited: false,
        });
        occupiedPositions.add(posKey);
      }
    }
  }

  return Array.from(placed.values());
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
          const dotColor = isCurrent
            ? colors.dotCurrent
            : placedRoom.visited
              ? colors.dotVisited
              : colors.dotKnown;
          const radius = isCurrent
            ? RADIUS_CURRENT
            : placedRoom.visited
              ? RADIUS_VISITED
              : RADIUS_KNOWN;

          return (
            <Circle
              key={placedRoom.key}
              cx={cx}
              cy={cy}
              r={radius}
              color={dotColor}
            />
          );
        })}
      </Group>
    </Canvas>
  );
}
