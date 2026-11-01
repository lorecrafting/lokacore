// What a cue is heard and felt as (book-ui.md, Effects, sound and haptics). A silent cue is neither;
// the settings gate each device on its own, so Sound off still leaves the haptic.
import type { Cue } from './cues.ts';
import { curlEnds, soundOf } from './cues.ts';
import { haptic, type HapticKind } from './haptic';
import { play } from './sound';
import { sound } from './tokens.ts';

// No haptic during a page turn: dropped, not held, for one felt late is felt as nothing's.
const feel = (kind: HapticKind) => {
  if (performance.now() >= curlEnds) haptic(kind);
};

export const playTurn = () => play('pageTurn');

export const playCue = (cue: Cue) => {
  const name = soundOf(cue);
  if (!name) return;
  play(name);
  const felt = (sound[name] as { haptic?: HapticKind }).haptic;
  if (felt) feel(felt);
};
