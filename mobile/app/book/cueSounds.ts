// What a cue is heard and felt as (book-ui.md, Effects, sound and haptics). A silent cue is neither;
// the settings gate each device on its own, so Sound off still leaves the haptic.
import type { Cue } from './cues.ts';
import { curlEnds, soundOf } from './cues.ts';
import { haptic, type HapticKind } from './haptic';
import { play } from './sound';
import { sound } from './tokens.ts';

// No haptic during a page turn: it waits for the curl's end, again if another turn began.
const feel = (kind: HapticKind) => {
  const left = curlEnds - performance.now();
  if (left > 0) setTimeout(() => feel(kind), left);
  else haptic(kind);
};

export const playCue = (cue: Cue) => {
  const name = soundOf(cue);
  if (!name) return;
  play(name);
  const felt = (sound[name] as { haptic?: HapticKind }).haptic;
  if (felt) feel(felt);
};
