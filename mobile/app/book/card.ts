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

// Runs `turn` after `ms` of foreground time; returns the stop.
function cardClock(
  timer: { current?: ReturnType<typeof setTimeout> },
  turn: () => void,
  ms = motion.card.auto,
) {
  let left = ms;
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

/**
 * A treated scene's line (book-ui.md, Book treatments): it rises `motion.reverie.lag` after the
 * page lands, over `motion.reverie`, then Continue shows over `motion.settle`. `complete` (a tap)
 * ends the rise at once and sends nothing; no clock ever sends. A screen reader, or an untreated
 * scene (`on` false), has the line and Continue at once.
 */
export function useArrival(on: boolean) {
  const [reader, setReader] = useState<boolean>();
  const [full, setFull] = useState(!on);
  const ink = useSharedValue(on ? 0 : 1);
  const next = useSharedValue(on ? 0 : 1);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // A tap or a reader shows Continue at once; the line's own end settles it in.
  const done = (settle: boolean) => {
    clearTimeout(timer.current);
    ink.value = 1;
    next.value = settle ? withTiming(1, { duration: motion.settle.duration }) : 1;
    setFull(true);
  };
  const complete = () => done(false);
  useEffect(() => {
    if (on) void screenReaderOn().then(setReader);
  }, []);
  useEffect(() => {
    if (reader === undefined) return;
    if (reader) return complete();
    const { lag, duration, easing } = motion.reverie;
    const reduceMotion = ReduceMotion.Never; // an opacity rise, ruled unchanged under reduced motion
    ink.value = withDelay(
      lag,
      withTiming(1, { duration, easing: curveOf(easing), reduceMotion }),
      reduceMotion,
    );
    return cardClock(timer, () => done(true), lag + duration);
  }, [reader]);
  const line = useAnimatedStyle(() => ({ opacity: ink.value }));
  const shown = useAnimatedStyle(() => ({ opacity: next.value }));
  return { full, complete, line, shown };
}
