// The haptic module in the browser: vibration where the browser has it, and the dev pulse that shows
// a haptic where it has none (book-ui.md, Effects, sound and haptics).
import * as tokens from './tokens.ts';

type HapticKind = Exclude<keyof typeof tokens.haptic, 'gap'>;

let on = true;
let last = -Infinity;
const shows = new Set<(kind: HapticKind) => void>();

export const hapticsOn = (next: boolean) => {
  on = next;
};
/** Who draws the pulse (HapticPulse). Returns the unsubscribe. */
export const onPulse = (show: (kind: HapticKind) => void) => {
  shows.add(show);
  return () => void shows.delete(show);
};

export function haptic(kind: HapticKind) {
  const now = Date.now();
  if (!on || now - last < tokens.haptic.gap) return;
  last = now;
  globalThis.navigator?.vibrate?.(tokens.haptic[kind] as number | number[]);
  if (__DEV__) for (const show of shows) show(kind); // never in a player build
}
