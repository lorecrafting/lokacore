// The chapter card's ink: PageTurn says whether a blurred picture lies under the arriving card.
import { createContext, useContext, useLayoutEffect } from 'react';
import {
  curveOf,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from './fade.ts';
import { motion } from './tokens.ts';

/** `waiting`: a picture is being taken; `picture`: it is down; none: no blur, the ink is simply there. */
export const cardContext = createContext<'waiting' | 'picture' | undefined>(undefined);

/** The opacity of a card's `i`th mark: dries `i` staggers in over a picture, else is there at once. */
export function useCardInk(i: number) {
  const card = useContext(cardContext);
  const ink = useSharedValue(card ? 0 : 1);
  useLayoutEffect(() => {
    if (card !== 'picture') {
      if (!card) ink.value = 1;
      return;
    }
    const reduceMotion = ReduceMotion.Never;
    const { duration, easing, stagger } = motion.card;
    ink.value = withDelay(
      stagger * i,
      withTiming(1, { duration, easing: curveOf(easing), reduceMotion }),
      reduceMotion,
    );
  }, [card]);
  return useAnimatedStyle(() => ({ opacity: ink.value }));
}
