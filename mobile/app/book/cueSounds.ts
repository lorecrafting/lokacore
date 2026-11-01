// What a cue is heard and felt as (book-ui.md, Effects, sound and haptics). A silent cue is neither;
// the settings gate each device on its own, so Sound off still leaves the haptic.
import type { Cue } from './cues.ts';
import { curlEnds, curlFor, soundOf } from './cues.ts';
import { haptic, type HapticKind } from './haptic';
import { fight, play } from './sound';
import { mix, motion, sound } from './tokens.ts';

// No haptic during a page turn: dropped, not held, for one felt late is felt as nothing's.
const feel = (kind: HapticKind) => {
  if (performance.now() >= curlEnds) haptic(kind);
};

export const playTurn = () => play('pageTurn');
export const playRiddleRight = () => {
  play('riddleRight');
  feel(sound.riddleRight.haptic as HapticKind);
};

const riffleLength = motion.quick.duration + motion.riffle.sweeps * motion.riffle.duration;
// One sound for the whole riffle, felt once it has landed (under reduced motion no curl: at once).
export const playRiffle = () => {
  play('riffle');
  const land = () => feel(sound.riffle.haptic as HapticKind);
  if (performance.now() >= curlEnds) return land();
  curlFor(riffleLength);
  setTimeout(land, riffleLength);
};

// One rung up its ladder, the top staying the top (book-ui.md, First times).
const stronger = <T>(ladder: readonly T[], rung: T) =>
  ladder[Math.min(ladder.indexOf(rung) + 1, ladder.length - 1)];
const TIERS = Object.keys(mix.tier);
const HAPTICS = ['selection', 'light', 'medium', 'heavy'] as const;

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
  const felt = (sound[name] as { haptic?: HapticKind }).haptic;
  if (!cue.first) {
    play(name);
    if (felt) feel(felt);
    return;
  }
  play(name, stronger(TIERS, sound[name].tier));
  if (felt) feel(stronger(HAPTICS, felt as (typeof HAPTICS)[number]));
};
