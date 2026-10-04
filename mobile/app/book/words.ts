// The app's own words for the kernel's codes (R6P Polish): what an accepted outcome says in the log
// and what a refusal reason says. A raw code is never shown as an answer; a code with no words here
// gets none (an outcome) or its code with spaces (a reason).

import type { Failed } from '../../packages/game-view/session.ts';

/** The line under the save-error headline: a Start over that is not confirmed gets its words. */
export const detail = (f: Failed) =>
  f.code === 'start_over_pending' ? 'start over not confirmed' : f.message;

// No entry or '': no answer line (a move, look or scan turns to a fresh page; a talk shows its
// choice in the NPC menu).
export const OUTCOME: Record<string, string> = {
  taken: 'Taken.',
  dropped: 'Dropped.',
  opened: 'Opened.',
  closed: 'Closed.',
  locked: 'Locked.',
  unlocked: 'Unlocked.',
  worn: 'You put it on.',
  removed: 'You take it off.',
  activated: 'You take on the task. It is in your journal.',
  activated_with_possession: 'You take on the task. It is in your journal.',
  choice_closed: 'You leave the question for now.',
  waited: 'Time passes.',
};

// The refusal codes the Lantern can reach by touch.
const REASON: Record<string, string> = {
  exit_locked: 'locked',
  exit_closed: 'closed',
  invalid_state: 'not now',
  not_present: 'not here',
  not_found: 'not here',
  not_owned: 'you are not holding it',
  insufficient_resource: 'too exhausted',
};
// A refused move's log line that is its own sentence, not "The way north is …" (0 MV).
export const SENTENCE: Record<string, string> = { insufficient_resource: 'You are too exhausted.' };
export const reason = (code: string) => REASON[code] ?? code.replaceAll('_', ' ');
