// The combat page's paper, which a blow washes and swells.
import { useContext, useEffect, type ReactNode } from 'react';
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
import { motion, opacity, size } from './tokens.ts';
import { fatalInk } from './heldLayer.ts';
import { footContext } from './UnderInk.tsx';

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
const afterWash = (peak: number) =>
  withSequence(
    ReduceMotion.Never,
    withTiming(0, { duration, ...never }),
    withTiming(peak, { duration: out, ...never }),
  );

/** One wash up to its peak and away (half of it under reduced motion, which it plays through). */
export const flashed = (still: boolean) =>
  withSequence(
    ReduceMotion.Never,
    withTiming(still ? opacity.washStill : opacity.wash, { duration, ...never }),
    withTiming(0, { duration: out, ...never }),
  );

// A fight's blows wash the paper; its death holds the red.
function useWash(still: boolean, peak: number, dead?: boolean) {
  const wash = useSharedValue(0);
  const held = useSharedValue(0);
  // A death outside a fight has no blow: the hold rises as the dead page lands (book-ui.md, Falling).
  useEffect(() => {
    if (dead) held.value = still ? peak : withTiming(peak, settled);
  }, [dead, peak]);
  useEffect(
    () =>
      onCue((cue) => {
        if (cue.name === 'hp_loss' && cue.wash) wash.value = flashed(still);
        if (cue.name !== 'death' || !cue.fight) return;
        held.value = still ? peak : cue.wash ? afterWash(peak) : withTiming(peak, settled);
      }),
    [still, peak],
  );
  return { wash, held };
}

// The fatal hold's bloodshot rim, reaching under the foot to the screen's edge.
const bloodshot = (ink: string, foot: number) => ({
  bottom: -foot,
  boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: size.bloodshot, color: ink, inset: true }],
});

/**
 * The paper under the combat page (book-ui.md, Blow wash).
 * - Use: Combat, and the dead page (`dead`), around a `paperless` Page.
 * - Rules: answers only an `hp_loss` with `wash`, which the Flash limit and the Flashes setting decide;
 *   below the ink; no layout change; a page turn remounts it, ending the wash. A death in a fight
 *   holds the red (`fatalInk`: oxblood at `opacity.fatal`, by polarity) until then, no pulse and no fade (book-ui.md, Falling): it
 *   rises as the fatal wash falls, or over the settle time when no wash peaked; a bloodshot rim at
 *   `opacity.bloodshot`, feathered in over `size.bloodshot`, rises and holds with it, to the screen's edge.
 * - States: at rest; washing; held after a death; dead (held from mount); reduced motion (half the wash, no swell; a death
 *   sets the hold at once, under the half wash: the two stay below the wash's peak).
 * - Story: CombatPage.stories.tsx
 */
export function Blow({
  children,
  under,
  dead,
}: {
  children: ReactNode;
  under?: ReactNode;
  dead?: boolean; // the dead page: the hold rises from mount, no blow (book-ui.md, Dead page)
}) {
  const c = usePalette();
  const still = useReducedMotion();
  const [ink, peak] = fatalInk(c);
  const { wash, held } = useWash(still, peak, dead);
  const paper = useAnimatedStyle(() => ({ opacity: wash.value }));
  const fatal = useAnimatedStyle(() => ({ opacity: held.value }));
  // The rim rises and holds with the flat red, at its own strength.
  const rim = useAnimatedStyle(() => ({
    opacity: (held.value / peak) * opacity.bloodshot,
  }));
  const foot = useContext(footContext);
  const page = useAnimatedStyle(() => ({
    transform: [{ scale: still ? 1 : 1 + ((swell - 1) * wash.value) / opacity.wash }],
  }));
  return (
    <View style={[grow, { backgroundColor: c.bg }]}>
      {layer(ink, [{ bottom: -foot }, fatal])}
      {layer('transparent', [bloodshot(ink, foot), rim])}
      {under}
      {layer(washInk(c), paper)}
      {/* The swell is clipped, not `under`, which reaches on below the page under the foot. */}
      <View style={[grow, { overflow: 'hidden' }]}>
        <Reanimated.View style={[grow, page]}>{children}</Reanimated.View>
      </View>
    </View>
  );
}
