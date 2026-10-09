// The palette cross-fade's curve, none under reduced motion; apart so node tests load the Book
// without Reanimated.
import { useReducedMotion, type EasingFunction } from 'react-native-reanimated';
import { easing } from './easing.ts';
import { motion } from './tokens.ts';

const curve = easing(motion.palette.easing) as EasingFunction;
export const usePaletteCurve = () => (useReducedMotion() ? undefined : curve);
