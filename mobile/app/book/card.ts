// The chapter card's ink: PageTurn says whether a blurred picture lies under the arriving card.
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isForeground, onForeground, screenReaderOn } from './cardDevice.ts';
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

// Runs `turn` after `motion.card.auto` of foreground time; returns the stop.
function cardClock(timer: { current?: ReturnType<typeof setTimeout> }, turn: () => void) {
  let left = motion.card.auto;
  let from = 0;
  const run = () => {
    from = Date.now();
    timer.current = setTimeout(turn, left);
  };
  let paused = !isForeground();
  if (!paused) run();
  const stop = onForeground((active) => {
    if (active === !paused) return; // inactive, then background: one pause
    paused = !active;
    if (active) run();
    else {
      clearTimeout(timer.current);
      left -= Date.now() - from;
    }
  });
  return () => {
    clearTimeout(timer.current);
    stop();
  };
}

/**
 * The card turns itself after `motion.card.auto`, its clock stopped while backgrounded; `turn` is
 * the tap that skips it. Once a screen reader is on (`reader`) there is no clock and no tap.
 */
export function useCardTurn(done: () => void) {
  const [reader, setReader] = useState<boolean>();
  const latest = useRef(done);
  latest.current = done; // a turn pops the stack it renders with
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fired = useRef(false);
  const turn = () => {
    clearTimeout(timer.current);
    if (fired.current) return;
    fired.current = true;
    latest.current();
  };
  useEffect(() => {
    void screenReaderOn().then(setReader);
  }, []);
  useEffect(() => {
    if (reader !== false) return;
    return cardClock(timer, turn);
  }, [reader]);
  return { reader, turn };
}
