// The press and ink-drying effects' one pair of hooks (book-ui.md, Effects, sound and haptics): on the
// UI thread through shared values, no per-frame JS. Tokens only.
import { useEffect } from 'react';
import {
  curveOf,
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from './fade.ts';
import { haptic, type HapticKind } from './haptic';
import { usePalette } from './palette.ts';
import { motion, opacity, size } from './tokens.ts';

const pressCurve = curveOf(motion.press.easing);
const dryCurve = curveOf(motion.dry.easing);
const reduceMotion = ReduceMotion.Never; // the state change still shows; only travel goes

/**
 * The look answers on press-in; the haptic waits for the commit, so a scroll never buzzes. Gives the
 * pressed amount, the Pressable's handlers, and `commit`, which wraps its onPress. A disabled Pressable
 * fires none of them.
 */
export function usePress(pulse?: HapticKind) {
  const pressed = useSharedValue(0);
  const to = (value: number, duration: number) => {
    pressed.value = withTiming(value, { duration, easing: pressCurve, reduceMotion });
  };
  const handlers = {
    onPressIn: () => to(1, motion.press.duration),
    onPressOut: () => to(0, motion.press.out),
  };
  const commit = (run: () => void) => () => {
    if (pulse) haptic(pulse);
    run();
  };
  return { pressed, handlers, commit };
}

type Press = ReturnType<typeof usePress>;

/** A lifted surface: `rest` blends `line` in at `opacity.press` and rises; a held one stays as it is. */
export function useLift({ pressed }: Press, rest: string, held = false) {
  const still = useReducedMotion();
  const { line } = usePalette();
  return useAnimatedStyle(() => ({
    backgroundColor: held
      ? rest
      : interpolateColor(pressed.value * opacity.press, [0, 1], [rest, line]),
    // Always written: a surface held mid-press must come back down.
    transform: [{ translateY: held || still ? 0 : -size.rule * pressed.value }],
  }));
}

/** A one-text ink press: the label's ink goes from `rest` to `to`. */
export function useInk({ pressed }: Press, rest: string, to: string) {
  return useAnimatedStyle(() => ({
    color: interpolateColor(pressed.value, [0, 1], [rest, to]),
  }));
}

/** A Tap's press: its ink thins by `opacity.press`, since nested Text colours cannot animate on native. */
export function useThin({ pressed }: Press, off: boolean) {
  return useAnimatedStyle(() => ({
    opacity: off ? 1 : 1 - opacity.press * pressed.value,
  }));
}

/** The drying amount from mount, 0 to 1, after `lag`; reduced motion: at once over `motion.fade`. */
export function useDrying(lag = 0, duration: number = motion.dry.duration) {
  const still = useReducedMotion();
  const dry = useSharedValue(0);
  useEffect(() => {
    const timing = withTiming(1, {
      duration: still ? motion.fade.duration : duration,
      easing: dryCurve,
      reduceMotion,
    });
    dry.value = lag && !still ? withDelay(lag, timing, reduceMotion) : timing;
  }, []); // eslint-disable-line
  return dry;
}

/**
 * Ink drying from mount: a text's colour goes from `dim` to `to`; with no `to` (a block), or under
 * reduced motion, a plain cross-fade.
 */
export function useDry(to?: string, lag = 0, duration: number = motion.dry.duration) {
  const still = useReducedMotion();
  const { dim } = usePalette();
  const dry = useDrying(lag, duration);
  return useAnimatedStyle(() =>
    to && !still
      ? { color: interpolateColor(dry.value, [0, 1], [dim, to]) }
      : { opacity: dry.value },
  );
}
