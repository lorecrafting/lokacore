// The app's own words for the kernel's codes (R6P Polish): what an accepted outcome says in the log
// and what a refusal reason says. A raw code is never shown as an answer; a code with no words here
// gets none (an outcome) or its code with spaces (a reason).

// No entry or '': no answer line (a move, look or scan turns to a fresh page; a talk draws its
// choice below).
export const OUTCOME: Record<string, string> = {
  taken: 'Taken.',
  dropped: 'Dropped.',
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
  not_owned: 'not yours',
};
export const reason = (code: string) => REASON[code] ?? code.replaceAll('_', ' ');
