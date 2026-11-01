// The sky on an exposed World page: Storm's light and Wind's corner (book-ui.md, Effects).
import { useEffect, useRef } from 'react';
import { flashesShown, onCue } from './cues.ts';
import {
  curveOf,
  Reanimated,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from './fade.ts';
import type { SharedValue } from 'react-native-reanimated';
import { haptic } from './haptic';
import { thunder } from './sound';
import { stormClock } from './stormClock.ts';
import { color, motion, opacity, space } from './tokens.ts';

const never = { reduceMotion: ReduceMotion.Never };
const fill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;
const corner = space.xl;
type Sky = { weather?: string; exposed: boolean; room?: string; world: boolean; turn: number };

/**
 * Lightning under the ink, and the paper of the top outer corner lifting in the wind.
 * - Use: BookView, first in the World page, so everything drawn after it is ink above it.
 * - Rules: `world` false (Combat, a scene, a chapter card, a page in a curl) draws nothing and rolls
 *   no thunder. Reduced motion or Flashes off keep the thunder and draw no light; not exposed there
 *   is no light, thunder is muffled and no haptic. Wind lifts on the change and once per room entry.
 * - States: at rest (nothing drawn); struck; fluttering.
 * - Story: stories/Storm.stories.tsx
 */
export function Storm(p: Sky) {
  const still = useReducedMotion();
  return (
    <>
      <Lightning {...p} still={still} />
      <WindCorner {...p} still={still} />
    </>
  );
}

const strike = (light: SharedValue<number>) => () => {
  const { duration, out, outEasing } = motion.afterimage;
  light.value = withSequence(
    ReduceMotion.Never,
    withTiming(opacity.afterimage, { duration, ...never }),
    withTiming(0, { duration: out, easing: curveOf(outEasing), ...never }),
  );
};

function Lightning(p: Sky & { still: boolean }) {
  const light = useSharedValue(0);
  const washed = useRef(-Infinity);
  const turned = useRef(-Infinity);
  const entry = useRef({ room: p.room, n: 0 });
  if (entry.current.room !== p.room) entry.current = { room: p.room, n: entry.current.n + 1 };
  const now = useRef(p);
  now.current = p;

  useEffect(
    () =>
      onCue((cue) => {
        if (cue.wash) washed.current = performance.now();
      }),
    [],
  );
  useEffect(() => {
    turned.current = performance.now();
  }, [p.turn]);
  useEffect(() => {
    if (p.weather !== 'storm') return;
    const sky = () => ({
      ...now.current,
      flashes: flashesShown(),
      washed: washed.current,
      entry: entry.current.n,
      turned: turned.current,
    });
    return stormClock(sky, { light: strike(light), thunder, heavy: () => haptic('heavy') });
  }, [p.weather]); // eslint-disable-line react-hooks/exhaustive-deps

  const struck = useAnimatedStyle(() => ({ opacity: light.value }));
  if (!p.world) return null;
  return (
    <Reanimated.View
      pointerEvents="none"
      style={[fill, { backgroundColor: color.light.bg }, struck]}
    />
  );
}

function WindCorner(p: Sky & { still: boolean }) {
  const lift = useSharedValue(0);
  const blows = p.weather === 'wind' && p.exposed && p.world && !p.still;
  useEffect(() => {
    if (!blows) return;
    const leg = motion.flutter.duration / (2 * motion.flutter.times);
    const rise = () => withTiming(motion.flutter.lift, { duration: leg, ...never });
    const fall = () => withTiming(0, { duration: leg, ...never });
    lift.value = withSequence(ReduceMotion.Never, rise(), fall(), rise(), fall());
  }, [blows, p.room]); // eslint-disable-line react-hooks/exhaustive-deps

  const paper = useAnimatedStyle(() => ({
    opacity: lift.value ? 1 : 0,
    transform: [{ translateY: -lift.value }],
  }));
  if (!p.world) return null;
  const fold = {
    position: 'absolute',
    top: 0,
    right: 0,
    borderTopWidth: corner,
    borderLeftWidth: corner,
    borderTopColor: color.light.line,
    borderLeftColor: 'transparent',
  } as const;
  return <Reanimated.View pointerEvents="none" style={[fold, paper]} />;
}
