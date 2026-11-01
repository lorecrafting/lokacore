// Storm's clock (book-ui.md, Storm): when the light strikes and when its thunder follows. No drawing here.
import { motion } from './tokens.ts';

export type StormNow = {
  world: boolean; // a World page
  turned: number; // when the page last turned, ms: no strike in the curl
  exposed: boolean;
  still: boolean; // reduced motion
  flashes: boolean;
  washed: number; // when the last blow wash fell, ms
  entry: number; // counts room entries
};
type Act = { light: () => void; thunder: (muffled: boolean) => void; heavy: () => void };

const between = ([low, high]: readonly number[]) => low! + Math.random() * (high! - low!);
const away = () => !!globalThis.document?.hidden;

/** Wind lifts once on the change to wind and once per room entry; a page opened and closed is neither. */
export function windEntry(
  seen: { current?: string },
  weather?: string,
  blows = false,
  room?: string,
) {
  if (weather !== 'wind') seen.current = undefined;
  if (!blows || seen.current === room) return false;
  seen.current = room;
  return true;
}

/** Runs for as long as the phase is `storm`; gives back its stop. */
export function stormClock(now: () => StormNow, act: Act) {
  let timer: ReturnType<typeof setTimeout>;
  let rumble: ReturnType<typeof setTimeout>;
  let heardIn = -1;
  const roll = () => {
    const s = now();
    if (!s.world || away()) return;
    act.thunder(!s.exposed);
    if (s.exposed && heardIn !== s.entry) {
      heardIn = s.entry;
      act.heavy();
    }
  };
  const strike = () => {
    const s = now();
    if (s.world && !away() && performance.now() - s.turned >= motion.turn.duration) {
      const clear = performance.now() - s.washed >= motion.flash.gap;
      if (s.exposed && !s.still && s.flashes && clear) act.light();
      rumble = setTimeout(roll, between(motion.afterimage.thunder));
    }
    timer = setTimeout(strike, between(motion.afterimage.every));
  };
  timer = setTimeout(strike, between(motion.afterimage.every));
  return () => {
    clearTimeout(timer);
    clearTimeout(rumble);
  };
}
