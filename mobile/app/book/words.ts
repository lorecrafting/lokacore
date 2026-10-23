// The app's own words for the kernel's codes (R6P Polish): what an accepted outcome says in the log
// and what a refusal reason says. A raw code is never shown as an answer; a code with no words here
// gets none (an outcome) or its code with spaces (a reason).

import type {
  DecisionResult,
  Failed,
  Game,
  GameView,
  Reply,
} from '../../packages/game-view/session.ts';
import type { DetailLine } from './logs.ts';

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

// The chapter card's label from the view's zero-based declaration index (protocol.md, `chapter`).
// ponytail: words to twelve; a later chapter shows its numeral.
const COUNT = 'one two three four five six seven eight nine ten eleven twelve'.split(' ');
export const chapterLabel = (index: number) => `Chapter ${COUNT[index] ?? index + 1}`;

/**
 * The line under the save-error headline, never a raw code or exception text: a Start over that is
 * not confirmed gets its words, an empty message or one that is only the kind none (the headline
 * says it), the browser's save-file lock a sentence, any other message one plain sentence.
 * ponytail: the lock is matched on Chrome's OPFS message text.
 */
export const detail = (f: Failed) =>
  f.code === 'start_over_pending'
    ? 'Start over was not confirmed.'
    : f.message === f.kind
      ? undefined
      : /Access Handles? cannot be created/.test(f.message)
        ? 'Loka is already open in another tab.'
        : f.message
          ? 'The save could not be opened.'
          : undefined;

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

// The refusal codes an offer can carry (book/reasons.test.ts).
const REASON: Record<string, string> = {
  exit_locked: 'locked',
  exit_closed: 'closed',
  invalid_state: 'not now',
  not_present: 'not here',
  not_found: 'not here',
  not_owned: 'you are not holding it',
  insufficient_resource: 'too exhausted',
  too_heavy: 'too heavy to carry',
  over_load: 'more than you can carry',
  cooldown: 'not yet',
  permission_denied: 'not allowed',
  invalid_target: 'not with that',
  quest_requirement: 'not part of your task yet',
  unsupported_capability: 'not in this book',
  budget_exceeded: 'more than the book can follow',
};
// The kernel's engine key resource.short names the unpaid cost (pass-1 R1); keys show raw, as on the status line.
export const message = (m: { key: string; bindings?: Record<string, unknown> }, text: Say) =>
  m.key === 'resource.short'
    ? `need ${String(m.bindings?.amount)} ${String(m.bindings?.resource)}`
    : text(m.key);
// A refused move's own sentence, not "The way north is …": keyed by the GameError's cause
// (RefusalCause), then by its code.
const SENTENCE: Record<string, string> = {
  insufficient_resource: 'You are too exhausted.',
  not_standing: 'You are not standing.',
};
type Refusal = { code: string; cause?: string };
export const refusedSentence = ({ code, cause }: Refusal) =>
  (cause && SENTENCE[cause]) ?? SENTENCE[code];
// The word of each RefusalCause (protocol/error.schema.json; book/reasons.test.ts): it names the
// one reason a shared code stands for, so it goes before the code's word.
const CAUSE: Record<string, string> = {
  not_standing: 'not standing',
  cursed: 'it will not come off',
};
export const given = (item: string, to: string) => `You give ${item} to ${to}.`;
export const reason = (code: string, cause?: string) =>
  (cause && CAUSE[cause]) ?? REASON[code] ?? code.replaceAll('_', ' ');
export const reasonOf = (r: Refusal) => reason(r.code, r.cause);
// An item page's refusal notes (book-ui.md, too heavy; pass-1 E8): a locked Take reads as ownership.
export const NOTED: Record<string, string> = {
  too_heavy: REASON.too_heavy!,
  over_load: REASON.over_load!,
  permission_denied: 'not yours',
  cooldown: REASON.cooldown!, // a held tool resting between uses (pass-2 R2)
};
// A shelf row's buy reason: the shop's stock is gone, or the player's purse is short.
const BUY: Record<string, string> = {
  not_owned: 'sold out',
  insufficient_resource: "can't afford",
};
export const buyReason = (code: string) => BUY[code] ?? reason(code);
// A shelf row's sell reason: the shop's own line (a fence's refusal of honest goods, pass-1 GE3), else the code's word.
export const sellReason = (
  s: { reason?: string; message?: { key: string } },
  text: (key: string) => string,
) => (s.message ? text(s.message.key) : reason(s.reason ?? ''));
// A hostile NPC's page when its cartridge gives no refusal line (Book hostile refusal).
export const holding = (name: string) => `${name} is holding it.`;
export const balance = (pennies: number) => `You have ${pennies}p.`;
export const refused = (name: string) => `${name} will have nothing to do with you.`;

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

// What one press answers: the narration, one line per record, or the outcome's words (words.ts;
// none: no line) of an accepted command, else the refusal in words. Never a raw outcome code.
export const replyLine = (r: Reply, text: Say, view: GameView, fallback?: string): DetailLine[] =>
  [answer(r, text, view, fallback)].flat().filter(Boolean);
export const lineText = (l: DetailLine) => (typeof l === 'string' ? l : l.text);

function answer(r: Reply, text: Say, view: GameView, fallback?: string): DetailLine | string[] {
  if (r.kind === 'stale_view') return 'The page had changed; here it is again.';
  if (r.kind !== 'saved') return UNDONE[r.kind] ?? `(${r.kind}${'code' in r ? ` ${r.code}` : ''})`;
  const d = r.decision;
  if (d.kind === 'rejected') {
    // a refused line, as a refused drag (model.ts `refused`)
    return {
      kind: 'refused',
      reason: reasonOf(d.error),
      text: refusedSentence(d.error) ?? `You can't do that: ${reasonOf(d.error)}.`,
    };
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
  const said = shown.map((t) => text(t.key)).filter(Boolean);
  return said.length ? said : (fallback ?? OUTCOME[d.outcome] ?? '');
}

// The Book's echo of an accepted speech press whose receipt has no narration (book-ui.md, Word bar),
// the word folded as the kernel folds it; no word, no echo.
export const spoken = (how: string, word: unknown, to?: string) =>
  typeof word === 'string'
    ? `You ${how} "${word.toLowerCase()}"${to ? ` to ${to}` : ''}.`
    : undefined;

type Events = Extract<DecisionResult, { kind: 'accepted' }>['events'];
const sentence = (s: string) => s.replace(/^./, (a) => a.toUpperCase());

// Navigation adds no duplicate heading. NPCs that leave or arrive while the player stays put
// still have a meaningful status line; one that died in the decision (`events`) left a corpse and
// the kill line told it. ponytail: inferred from the view; kernel schedule narration replaces it.
export function comings(was: GameView, now: GameView, text: Say, events: Events = []): string[] {
  if (was.place.id !== now.place.id) return [];
  const dead = events.flatMap(({ payload: e }) => (e.type === 'entity_died' ? [e.victim_id] : []));
  const gone = (a: GameView, b: GameView) =>
    a.entities.filter((e) => e.kind === 'npc' && !b.entities.some((f) => f.id === e.id));
  return [
    ...gone(was, now)
      .filter((e) => e.id !== was.combat?.opponent_id && !dead.includes(e.id))
      .map((e) => `${sentence(text(e.name))} leaves.`),
    ...gone(now, was).map((e) => `${sentence(text(e.name))} arrives.`),
  ];
}
