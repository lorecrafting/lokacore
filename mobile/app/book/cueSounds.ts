// What a cue is heard and felt as (book-ui.md, Effects, sound and haptics). A silent cue is neither;
// the settings gate each device on its own, so Sound off still leaves the haptic.
import type { Cue } from './cues.ts';
import { curlEnds, curlFor, onCue, soundOf } from './cues.ts';
import { haptic, type HapticKind } from './haptic';
import { fight, play } from './sound';
import { mix, motion, sound } from './tokens.ts';

// No haptic during a page turn: dropped, not held, for one felt late is felt as nothing's; a level's
// is held to the curl's end (looked at again, for a riffle can lengthen it), for a level is never
// dropped (book-ui.md); a death, the last thing felt, or the Book going cancels it.
let waiting: ReturnType<typeof setTimeout> | undefined;
const feel = (kind: HapticKind, held = false) => {
  const wait = curlEnds - performance.now();
  if (wait <= 0) haptic(kind);
  else if (held) waiting = setTimeout(() => feel(kind, true), wait);
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
  const land = () => haptic(sound.riffle.haptic as HapticKind); // past feel's gate: this riffle holds it
  if (performance.now() >= curlEnds) return land();
  curlFor(riffleLength);
  setTimeout(land, riffleLength);
};

// One rung up its ladder, the top staying the top (book-ui.md, First times).
const stronger = <T>(ladder: readonly T[], rung: T) =>
  ladder[Math.min(ladder.indexOf(rung) + 1, ladder.length - 1)];
const TIERS = Object.keys(mix.tier);
const HAPTICS = ['selection', 'light', 'medium', 'heavy'] as const;

// A fight won with a level waits out the settle hold from the level's note, so the note is heard
// (book-ui.md, A level is never dropped); any later turn of the music cancels it.
let fanfare: ReturnType<typeof setTimeout> | undefined;
const music = (event: Parameters<typeof fight>[0]) => {
  clearTimeout(fanfare);
  fanfare = undefined;
  fight(event);
};
const hold = () => {
  clearTimeout(fanfare);
  fanfare = setTimeout(() => music('won'), motion.settle.hold);
};

/** Hear the cue bus until the Book goes; a fight's loop goes with it (Start over remounts it). */
export const hearCues = () => {
  const off = onCue(playCue);
  return () => {
    off();
    clearTimeout(waiting);
    music('cut');
  };
};

export const playCue = (cue: Cue) => {
  if (cue.name === 'combat_open') {
    music(cue.resumed ? 'resume' : 'open');
    if (!cue.resumed) feel('medium');
  } else if (cue.name === 'combat_close') {
    if (cue.end !== 'fell') music('away');
    else if (cue.levelled) hold();
    else {
      music('won');
      feel(sound.fightWon.haptic as HapticKind);
    }
  } else if (cue.name === 'level' && fanfare) hold();
  else if (cue.name === 'death') {
    clearTimeout(waiting);
    music(cue.fight ? 'cut' : 'fell');
    // The last thing felt, whatever page is turning: in a fight it is the thud's own.
    if (!cue.fight) haptic(sound.blow.haptic as HapticKind);
  }
  const name = soundOf(cue);
  if (!name) return;
  const felt = (sound[name] as { haptic?: HapticKind }).haptic;
  const held = cue.name === 'level';
  if (!cue.first) {
    play(name);
    if (felt) feel(felt, held);
    return;
  }
  play(name, stronger(TIERS, sound[name].tier));
  if (felt) feel(stronger(HAPTICS, felt as (typeof HAPTICS)[number]), held);
};
