// The combat page's paper, which a blow washes and swells.
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { onCue } from './cues.ts';
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
import { usePalette, washInk } from './palette.ts';
import { motion, opacity } from './tokens.ts';

const { duration, out, swell } = motion.flash;
// Never: Reanimated would otherwise skip the half wash reduced motion keeps.
const never = { easing: curveOf(motion.flash.easing), reduceMotion: ReduceMotion.Never };

const grow = { flex: 1 }; // mutate-skip: layout
const fill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const; // mutate-skip: layout

export const layer = (backgroundColor: string, style: object) => (
  <Reanimated.View style={[fill, { backgroundColor }, style]} pointerEvents="none" aria-hidden />
);

const settled = { ...never, duration: motion.settle.duration };
// Rising only as the wash falls, the two never add up past the wash's own peak, and never dip.
const afterWash = () =>
  withSequence(
    ReduceMotion.Never,
    withTiming(0, { duration, ...never }),
    withTiming(opacity.fatal, { duration: out, ...never }),
  );

/** One wash up to its peak and away (half of it under reduced motion, which it plays through). */
export const flashed = (still: boolean) =>
  withSequence(
    ReduceMotion.Never,
    withTiming(still ? opacity.washStill : opacity.wash, { duration, ...never }),
    withTiming(0, { duration: out, ...never }),
  );

/**
 * The paper under the combat page (book-ui.md, Blow wash).
 * - Use: Combat only, around a `paperless` Page.
 * - Rules: answers only an `hp_loss` with `wash`, which the Flash limit and the Flashes setting decide;
 *   below the ink; no layout change; a page turn remounts it, ending the wash. A death in a fight
 *   holds the red at `opacity.fatal` until then, no pulse and no fade (book-ui.md, Falling): it
 *   rises as the fatal wash falls, or over the settle time when no wash peaked.
 * - States: at rest; washing; held after a death; reduced motion (half the wash, no swell; a death
 *   sets the hold at once, under the half wash: the two stay below the wash's peak).
 * - Story: CombatPage.stories.tsx
 */
export function Blow({ children, under }: { children: ReactNode; under?: ReactNode }) {
  const c = usePalette();
  const still = useReducedMotion();
  const wash = useSharedValue(0);
  const held = useSharedValue(0);
  useEffect(
    () =>
      onCue((cue) => {
        if (cue.name === 'hp_loss' && cue.wash) wash.value = flashed(still);
        if (cue.name !== 'death' || !cue.fight) return;
        held.value = still
          ? opacity.fatal
          : cue.wash
            ? afterWash()
            : withTiming(opacity.fatal, settled);
      }),
    [still],
  );
  const paper = useAnimatedStyle(() => ({ opacity: wash.value }));
  const fatal = useAnimatedStyle(() => ({ opacity: held.value }));
  const page = useAnimatedStyle(() => ({
    transform: [{ scale: still ? 1 : 1 + ((swell - 1) * wash.value) / opacity.wash }],
  }));
  return (
    <View style={[grow, { backgroundColor: c.bg }]}>
      {layer(washInk(c), fatal)}
      {under}
      {layer(washInk(c), paper)}
      {/* The swell is clipped, not `under`, which reaches on below the page under the foot. */}
      <View style={[grow, { overflow: 'hidden' }]}>
        <Reanimated.View style={[grow, page]}>{children}</Reanimated.View>
      </View>
    </View>
  );
}
