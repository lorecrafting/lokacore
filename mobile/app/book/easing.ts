// The Book's easing curves by token name (tokens.ts motion.*.easing, BOOK-UI-COMPONENTS.md#page-turn):
// an unknown name is an error, never a silent default.
import { Easing, type EasingFunction, type EasingFunctionFactory } from 'react-native-reanimated';

const curves: Record<string, EasingFunction | EasingFunctionFactory> = {
  ease: Easing.bezier(0.25, 0.1, 0.25, 1), // CSS `ease`
  inOutQuad: Easing.inOut(Easing.quad),
  linear: Easing.linear,
};

export function easing(name: string) {
  const curve = curves[name];
  if (!curve) throw new Error(`unknown easing ${name}`);
  return curve;
}
