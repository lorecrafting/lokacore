// The footer minimap's drawing, in map units drawn zoomed (one unit = ZOOM px) and shrunk by
// 1/ZOOM at rest, so it is crisp both ways. You are the dot; each compass exit is a path out to
// an open ring, or a stub ending in a red tick when closed; up and down are stair nodes that fade
// in with the zoom. Real data only: the current room and its exits.
import { type ReactNode, useRef } from 'react';
import { Animated, View } from 'react-native';
import { Text } from './Text.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { Reanimated } from './fade.ts';
import { ANGLE, STAIR, ZOOM as U } from './joystick.ts';
import { usePalette } from './palette.ts';
import { useDry } from './press.ts';
import { font } from './tokens.ts';

type Exit = GameView['exits'][number];
const [STEP, YOU, RING, NODE] = [12, 2.6, 1.5, 2.6]; // ring distance, dot, ring and stair node radii

function Disc(p: {
  x: number;
  y: number;
  r: number;
  fill?: string;
  border?: string;
  dashed?: boolean;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        left: (p.x - p.r) * U,
        top: (p.y - p.r) * U,
        width: p.r * 2 * U,
        height: p.r * 2 * U,
        borderRadius: p.r * U,
        backgroundColor: p.fill,
        borderColor: p.border,
        borderWidth: p.border ? 0.9 * U : 0,
        borderStyle: p.dashed ? 'dashed' : 'solid',
      }}
    />
  );
}

function Line(p: { from: number[]; to: number[]; color: string; w?: number }) {
  const [dx, dy] = [p.to[0] - p.from[0], p.to[1] - p.from[1]];
  const [len, w] = [Math.hypot(dx, dy) * U, (p.w ?? 0.9) * U];
  return (
    <View
      style={{
        position: 'absolute',
        left: ((p.from[0] + p.to[0]) / 2) * U - len / 2,
        top: ((p.from[1] + p.to[1]) / 2) * U - w / 2,
        width: len,
        height: w,
        backgroundColor: p.color,
        transform: [{ rotate: `${(Math.atan2(dy, dx) * 180) / Math.PI}deg` }],
      }}
    />
  );
}

function Path({ exit, on }: { exit: Exit; on: boolean }) {
  const c = usePalette();
  const a = (ANGLE[exit.direction] * Math.PI) / 180;
  const v = [Math.sin(a), -Math.cos(a)];
  const at = (n: number) => [v[0] * n, v[1] * n];
  const w = on ? 1.8 : 0.9;
  // Colour roles (Footer's doc comment): a path at rest in `dim`, the lit one in `fg`,
  // a barred way in `danger` (a shut, unlocked door in the path ink), your dot in `action`; so at
  // night the exits no longer read as a "+".
  const ink = on ? c.fg : c.dim;
  const bar = barred(exit, ink, c.danger);
  if (exit.available)
    return (
      <>
        <Line from={at(YOU)} to={at(STEP - RING)} color={ink} w={w} />
        <Disc x={at(STEP)[0]} y={at(STEP)[1]} r={RING} fill={on ? c.fg : c.bg} border={ink} />
      </>
    );
  const [x, y] = at(STEP * 0.6);
  return (
    <>
      <Line from={at(YOU)} to={[x, y]} color={bar} w={w} />
      <Line
        from={[x - v[1] * 1.6, y + v[0] * 1.6]}
        to={[x + v[1] * 1.6, y - v[0] * 1.6]}
        color={bar}
      />
    </>
  );
}

// A closed door you may open reads as a path; locked or otherwise barred, as danger.
const barred = (exit: Exit, ink: string, danger: string) =>
  exit.door?.state === 'closed' ? ink : danger;

function Stair({ exit, on }: { exit: Exit; on: boolean }) {
  const c = usePalette();
  const [x, y] = STAIR[exit.direction];
  const up = exit.direction === 'up';
  return (
    <>
      <Disc
        x={x}
        y={y}
        r={NODE}
        fill={on ? c.fg : c.bg}
        border={exit.available ? (on ? c.fg : c.dim) : barred(exit, on ? c.fg : c.dim, c.danger)}
        dashed={!exit.available}
      />
      {/* Part of the drawing, not the Map button's shown text (book-ui.md, Label in name). */}
      <Text
        aria-hidden
        style={{
          position: 'absolute',
          left: (x - 8) * U,
          top: (y + (up ? -7.2 : 3.2)) * U,
          width: 16 * U,
          textAlign: 'center',
          fontFamily: font.body,
          fontSize: 3.6 * U,
          color: c.dim,
        }}
      >
        {exit.direction}
      </Text>
    </>
  );
}

// The ways newly open in this room (book-ui.md, Lever and latch); a first view's or a new room's are just there.
type Way = Exit['direction'];
type Seen = { room: string; open: Way[]; drying: Way[] };
function seenNow(was: Seen | undefined, room: string, exits: readonly Exit[]): Seen {
  const open = exits.filter((e) => e.available).map((e) => e.direction);
  if (was?.room !== room) return { room, open, drying: [] };
  const newly = open.filter((d) => !was.open.includes(d));
  return { room, open, drying: [...was.drying.filter((d) => open.includes(d)), ...newly] };
}

const Dry = ({ children }: { children: ReactNode }) => (
  <Reanimated.View style={useDry()}>{children}</Reanimated.View>
);

/**
 * The footer minimap's drawing: you are the dot; each exit a path to an open ring, or a stub with
 * a tick when barred: in the path ink for a closed door, `danger` when locked or otherwise barred
 * (owner 2026-10-23: the door state shows here, not on World); stair nodes fade in with the zoom;
 * a compass way newly open in the room dries in.
 * - Use: Footer only.
 * - Rules: a drawing, exempt from space tokens; real data only (the current room and its exits).
 * - Story: Footer.stories.tsx
 */
export function MapDrawing(p: {
  room: string;
  exits: readonly Exit[];
  lit: string | null;
  zoom: Animated.Value; // 0 at rest, 1 zoomed
  knob: { x: number; y: number }; // your dot's offset from the middle, in zoomed px
}) {
  const c = usePalette();
  const seen = useRef<Seen | undefined>(undefined);
  seen.current = seenNow(seen.current, p.room, p.exits);
  const { drying } = seen.current;
  const scale = p.zoom.interpolate({ inputRange: [0, 1], outputRange: [1 / U, 1] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: 28, top: 28, transform: [{ scale }] }}
    >
      <Animated.View style={{ opacity: p.zoom }}>
        <Disc x={0} y={0} r={36} fill={c.bg} />
      </Animated.View>
      {p.exits.map((e) =>
        e.direction in ANGLE ? (
          drying.includes(e.direction) ? (
            <Dry key={e.direction}>
              <Path exit={e} on={e.direction === p.lit} />
            </Dry>
          ) : (
            <Path key={e.direction} exit={e} on={e.direction === p.lit} />
          )
        ) : e.direction in STAIR ? (
          <Animated.View key={e.direction} style={{ opacity: p.zoom }}>
            <Stair exit={e} on={e.direction === p.lit} />
          </Animated.View>
        ) : null,
      )}
      {/* Placed by left/top, not a transform wrapper: that displaced the dot (mobile lessons, Polish O-1). */}
      <Disc x={p.knob.x / U} y={p.knob.y / U} r={YOU} fill={c.action} />
    </Animated.View>
  );
}
