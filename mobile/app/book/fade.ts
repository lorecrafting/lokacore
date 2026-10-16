// The palette cross-fade's curve, none under reduced motion, the reduced-motion flag the Book's
// decorations read and the status ring's drain; apart so node tests load the Book without Reanimated.
import { useReducedMotion } from 'react-native-reanimated';
export { useReducedMotion };
export {
  default as Reanimated,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { easing } from './easing.ts';
import { motion } from './tokens.ts';

const named = easing(motion.palette.easing);
const curve = 'factory' in named ? named.factory() : named; // `ease` (bezier) is a factory
export const usePaletteCurve = () => (useReducedMotion() ? undefined : curve);
