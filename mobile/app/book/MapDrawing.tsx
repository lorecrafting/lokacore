// The footer minimap's drawing, in map units drawn zoomed (one unit = ZOOM px) and shrunk by
// 1/ZOOM at rest, so it is crisp both ways. You are the dot; each compass exit is a path out to
// an open ring, or a stub ending in a red tick when closed; up and down are stair nodes that fade
// in with the zoom. Real data only: the current room and its exits.
import { Animated, Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { ANGLE, STAIR, ZOOM as U } from './joystick.ts';
import { body, paper } from './paper.ts';

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
  const a = (ANGLE[exit.direction] * Math.PI) / 180;
  const v = [Math.sin(a), -Math.cos(a)];
  const at = (n: number) => [v[0] * n, v[1] * n];
  const w = on ? 1.8 : 0.9;
  if (exit.available)
    return (
      <>
        <Line from={at(YOU)} to={at(STEP - RING)} color={paper.fg} w={w} />
        <Disc
          x={at(STEP)[0]}
          y={at(STEP)[1]}
          r={RING}
          fill={on ? paper.fg : paper.bg}
          border={paper.fg}
        />
      </>
    );
  const [x, y] = at(STEP * 0.6);
  return (
    <>
      <Line from={at(YOU)} to={[x, y]} color={paper.accent} w={w} />
      <Line
        from={[x - v[1] * 1.6, y + v[0] * 1.6]}
        to={[x + v[1] * 1.6, y - v[0] * 1.6]}
        color={paper.accent}
      />
    </>
  );
}

function Stair({ exit, on }: { exit: Exit; on: boolean }) {
  const [x, y] = STAIR[exit.direction];
  const up = exit.direction === 'up';
  return (
    <>
      <Disc
        x={x}
        y={y}
        r={NODE}
        fill={on ? paper.fg : paper.bg}
        border={exit.available ? paper.fg : paper.accent}
        dashed={!exit.available}
      />
      <Text
        style={{
          position: 'absolute',
          left: (x - 8) * U,
          top: (y + (up ? -7.2 : 3.2)) * U,
          width: 16 * U,
          textAlign: 'center',
          fontFamily: body,
          fontSize: 3.6 * U,
          color: paper.dim,
        }}
      >
        {exit.direction}
      </Text>
    </>
  );
}

export function MapDrawing(p: {
  exits: readonly Exit[];
  lit: string | null;
  zoom: Animated.Value; // 0 at rest, 1 zoomed
  knob: Animated.ValueXY; // your dot's offset from the middle, in zoomed px
}) {
  const scale = p.zoom.interpolate({ inputRange: [0, 1], outputRange: [1 / U, 1] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: 28, top: 28, transform: [{ scale }] }}
    >
      <Animated.View style={{ opacity: p.zoom }}>
        <Disc x={0} y={0} r={36} fill={paper.bg} />
      </Animated.View>
      {p.exits.map((e) =>
        e.direction in ANGLE ? (
          <Path key={e.direction} exit={e} on={e.direction === p.lit} />
        ) : e.direction in STAIR ? (
          <Animated.View key={e.direction} style={{ opacity: p.zoom }}>
            <Stair exit={e} on={e.direction === p.lit} />
          </Animated.View>
        ) : null,
      )}
      <Animated.View style={{ transform: p.knob.getTranslateTransform() }}>
        <Disc x={0} y={0} r={YOU} fill={paper.fg} />
      </Animated.View>
    </Animated.View>
  );
}
