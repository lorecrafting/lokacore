// What a cue is heard and felt as (book-ui.md, Effects, sound and haptics). A silent cue is neither;
// the settings gate each device on its own, so Sound off still leaves the haptic.
import type { Cue } from './cues.ts';
import { curlEnds, soundOf } from './cues.ts';
import { haptic, type HapticKind } from './haptic';
import { fight, play } from './sound';
import { sound } from './tokens.ts';

// No haptic during a page turn: dropped, not held, for one felt late is felt as nothing's.
const feel = (kind: HapticKind) => {
  if (performance.now() >= curlEnds) haptic(kind);
};

export const playTurn = () => play('pageTurn');

export const playCue = (cue: Cue) => {
  if (cue.name === 'combat_open') {
    fight(cue.resumed ? 'resume' : 'open');
    if (!cue.resumed) feel('medium');
  } else if (cue.name === 'combat_close') {
    fight(cue.end === 'fell' ? 'won' : 'away');
    if (cue.end === 'fell') feel(sound.fightWon.haptic as HapticKind);
  } else if (cue.name === 'death') {
    fight('cut');
    // The last thing felt, whatever page is turning: in a fight it is the thud's own.
    if (!cue.fight) haptic(sound.blow.haptic as HapticKind);
  }
  const name = soundOf(cue);
  if (!name) return;
  play(name);
  const felt = (sound[name] as { haptic?: HapticKind }).haptic;
  if (felt) feel(felt);
};
