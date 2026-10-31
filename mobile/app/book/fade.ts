// The palette cross-fade's curve, none under reduced motion, the reduced-motion flag the Book's
// decorations read, the status ring's drain and the effects' animated pieces; apart so node tests
// load the Book without Reanimated.
import { Pressable } from 'react-native';
import Reanimated, { useReducedMotion } from 'react-native-reanimated';
export { useReducedMotion };
export {
  default as Reanimated,
  Easing,
  FadeOut,
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { easing } from './easing.ts';
import { Text } from './Text.tsx';
import { motion } from './tokens.ts';

export const InkText = Reanimated.createAnimatedComponent(Text);
export const LiftPressable = Reanimated.createAnimatedComponent(Pressable);
export const curveOf = (name: string) => {
  const named = easing(name);
  return 'factory' in named ? named.factory() : named; // `ease` (bezier) is a factory
};
const curve = curveOf(motion.palette.easing);
export const usePaletteCurve = () => (useReducedMotion() ? undefined : curve);
