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

/**
 * The paper under the combat page (book-ui.md, Blow wash).
 * - Use: Combat only, around a `paperless` Page.
 * - Rules: answers only a cue with `wash`, which the Flash limit and the Flashes setting decide;
 *   below the ink; no layout change; a page turn remounts it, ending the wash.
 * - States: at rest; washing; reduced motion (half the wash, no swell).
 * - Story: CombatPage.stories.tsx
 */
export function Blow({ children }: { children: ReactNode }) {
  const c = usePalette();
  const still = useReducedMotion();
  const wash = useSharedValue(0);
  useEffect(
    () =>
      onCue((cue) => {
        if (!cue.wash) return;
        // Never: Reanimated would otherwise skip the half wash reduced motion keeps.
        const never = { easing: curveOf(motion.flash.easing), reduceMotion: ReduceMotion.Never };
        wash.value = withSequence(
          ReduceMotion.Never,
          withTiming(still ? opacity.washStill : opacity.wash, { duration, ...never }),
          withTiming(0, { duration: out, ...never }),
        );
      }),
    [still],
  );
  const paper = useAnimatedStyle(() => ({ opacity: wash.value }));
  const page = useAnimatedStyle(() => ({
    transform: [{ scale: still ? 1 : 1 + ((swell - 1) * wash.value) / opacity.wash }],
  }));
  return (
    <View style={{ backgroundColor: c.bg, flex: 1 }}>
      <Reanimated.View
        style={[
          { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
          { backgroundColor: washInk(c) },
          paper,
        ]}
        pointerEvents="none"
        aria-hidden
      />
      <Reanimated.View style={[{ flex: 1 }, page]}>{children}</Reanimated.View>
    </View>
  );
}
