// The app's own words for the kernel's codes (R6P Polish): what an accepted outcome says in the log
// and what a refusal reason says. A raw code is never shown as an answer; a code with no words here
// gets none (an outcome) or its code with spaces (a reason).

import type { Failed, Game, GameView, Reply } from '../../packages/game-view/session.ts';

// A text key's words, and an action label's. ponytail: the cartridge has no text for most action
// labels yet, so a label shows the key's last word, capitalised as the texted labels are.
export const sayers = (g: Game): { text: Say; label: Say } => ({
  text: (key) => g.text(key) ?? key,
  label: (key) =>
    g.text(key) ??
    key
      .replace(/^actions?\./, '')
      .replaceAll('_', ' ')
      .replace(/^./, (a) => a.toUpperCase()),
});

/** The line under the save-error headline: a Start over that is not confirmed gets its words. */
export const detail = (f: Failed) =>
  f.code === 'start_over_pending' ? 'start over not confirmed' : f.message;

// No entry or '': no answer line (a move, look or scan turns to a fresh page; a talk shows its
// choice in the NPC menu).
export const OUTCOME: Record<string, string> = {
  put: 'Stored.',
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
  too_heavy: 'too heavy to carry',
};
// A refused move's log line that is its own sentence, not "The way north is …" (0 MV).
export const SENTENCE: Record<string, string> = { insufficient_resource: 'You are too exhausted.' };
export const reason = (code: string) => REASON[code] ?? code.replaceAll('_', ' ');

type Say = (key: string) => string;

// Compare structured TextKeys, never rendered English. Authored non-navigation consequences stay.
export const withoutHeading = <T extends { key: string }>(lines: readonly T[], view: GameView) =>
  lines.filter((t) => t.key !== view.place.title.key && t.key !== view.place.description?.key);

// A press that changed nothing, as one plain sentence (book-ui.md, Shared elapsed status).
const UNDONE: Partial<Record<Reply['kind'], string>> = {
  conflict: 'The book is still catching up; try again.',
  invalid: "That can't be done.",
  unauthorized: "That isn't yours to do.",
};

// What one press answers: the narration or the outcome's words (words.ts; none: '') of an accepted
// command, else the refusal in words. Never a raw outcome code.
export function replyLine(r: Reply, text: Say, view: GameView, fallback?: string): string {
  if (r.kind === 'stale_view') return 'The page had changed; here it is again.';
  if (r.kind !== 'saved') return UNDONE[r.kind] ?? `(${r.kind}${'code' in r ? ` ${r.code}` : ''})`;
  const d = r.decision;
  if (d.kind === 'rejected') {
    const { code } = d.error; // the same sentence as a refused drag (model.ts `refused`)
    return SENTENCE[code] ?? `You can't do that: ${reason(code)}.`;
  }
  if (d.kind === 'fault') return '';
  if (d.outcome === 'located' && d.location) {
    const location = d.location;
    const name =
      view.known_npcs?.find((n) => n.id === location.target_id)?.name ??
      view.entities.find((n) => n.id === location.target_id)?.name;
    const who = name ? text(name) : 'They';
    if (location.status === 'here') return `${who}: here.`;
    if (location.status === 'unknown') return 'Their whereabouts are unknown.';
    const room = view.map?.rooms.find((r) => r.id === location.room_id);
    return `${who}: last seen at ${room ? text(room.title) : 'a previously observed place'} at ${location.at}s.`;
  }
  const lines = d.narration ?? [];
  const shown = ['looked', 'moved'].includes(d.outcome) ? withoutHeading(lines, view) : lines;
  return shown.map((t) => text(t.key)).join(' ') || (fallback ?? OUTCOME[d.outcome] ?? '');
}

const sentence = (s: string) => s.replace(/^./, (a) => a.toUpperCase());

// Navigation adds no duplicate heading. NPCs that leave or arrive while the player stays put
// still have a meaningful status line. ponytail: inferred from the view; kernel schedule narration replaces it.
export function comings(was: GameView, now: GameView, text: Say): string[] {
  if (was.place.id !== now.place.id) return [];
  const gone = (a: GameView, b: GameView) =>
    a.entities.filter((e) => e.kind === 'npc' && !b.entities.some((f) => f.id === e.id));
  return [
    ...gone(was, now)
      .filter((e) => e.id !== was.combat?.opponent_id)
      .map((e) => `${sentence(text(e.name))} leaves.`),
    ...gone(now, was).map((e) => `${sentence(text(e.name))} arrives.`),
  ];
}
