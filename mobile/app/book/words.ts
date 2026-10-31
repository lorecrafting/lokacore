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
import { emoteSentence, lineSentence } from '../../packages/game-view/line_words.ts';
import { things } from './item-pages.ts';
import { levelWords } from './pick.ts';

// A text key's words, and an action label's. ponytail: the cartridge has no text for most action
// labels yet, so a label shows the key's last word, capitalised as the texted labels are.
export const sayers = (g: Game): { text: Say; label: Say } => ({
  text: (key) => g.text(key) ?? (key === 'place.dark' ? "It's too dark to see..." : key),
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

// The browser's save-file lock: another tab holds the save (Try again once it closes).
export const locked = (f: Failed) => /Access Handles? cannot be created/.test(f.message);

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
      : locked(f)
        ? 'Loka is already open in another tab.'
        : f.message
          ? 'The save could not be opened.'
          : undefined;

// Book UI Conditions details: seconds under two minutes, whole minutes under two hours, then hours.
export const dur = (s: number) =>
  s >= 7200 ? `${Math.round(s / 3600)}h` : s >= 120 ? `${Math.round(s / 60)}m` : `${s}s`;
// No entry or '': no answer line (a move, look or scan turns to a fresh page; a talk shows its
// choice in the NPC menu).
export const OUTCOME: Record<string, string> = {
  activated: 'You take on the task. It is in your journal.',
  activated_with_possession: 'You take on the task. It is in your journal.',
  choice_closed: 'You leave the question for now.',
  waited: 'Time passes.',
};

// A wield-slot item with no authored equip words (book-ui.md, Equipment and skills).
const WIELD: Record<string, readonly [string, string]> = {
  'equipment.worn': ['You take up {item}.', '{actor} takes up {item}.'],
  'equipment.removed': ['You put away {item}.', '{actor} puts away {item}.'],
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
// A refusal's own sentence, not "The way north is …" or "You can't do that—…": keyed by the
// GameError's cause (RefusalCause), then by its code.
export const SENTENCE: Record<string, string> = {
  insufficient_resource: 'You are too exhausted.',
  not_standing: 'You are not standing.',
  cursed: 'It will not come off.',
  too_heavy: "It's too heavy to carry.",
  over_load: "That's more than you can carry.",
  cannot_be_hurt: "That can't be hurt.",
};
export type Refusal = { code: string; cause?: string };
// A shut door's refusal ("The door to the south is locked.", owner 2026-10-23); none when open.
const AT: Record<string, string> = { up: 'above', down: 'below' };
export const doorSentence = (x: { direction: string; door?: { state: string } }) =>
  x.door && x.door.state !== 'open'
    ? `The door ${AT[x.direction] ?? `to the ${x.direction}`} is ${x.door.state}.`
    : undefined;
export const refusedSentence = ({ code, cause }: Refusal) =>
  (cause && SENTENCE[cause]) ?? SENTENCE[code];
// The word of each RefusalCause (protocol/error.schema.json; book/reasons.test.ts): it names the
// one reason a shared code stands for, so it goes before the code's word.
const CAUSE: Record<string, string> = {
  not_standing: 'not standing',
  cursed: 'it will not come off',
  cannot_be_hurt: 'cannot be hurt',
};
export const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// A use pair's line without narration: "You quench a cart with a bucket." (book-ui.md, Pick a second thing).
export const used = (label: string, target: string, tool: string) =>
  `You ${lower(label)} ${target} with ${tool}.`;
// An aimed spell's line without narration: "You cast lux on a lantern." (same section).
export const cast = (label: string, target: string) => `You cast ${lower(label)} on ${target}.`;
export const reason = (code: string, cause?: string) =>
  (cause && CAUSE[cause]) ?? REASON[code] ?? code.replaceAll('_', ' ');
// An appositive name closes with a comma before its verb: "Bess, the alewife, is here." (Line placement)
export const subject = (name: string) => (name.includes(', ') ? `${name},` : name);
export const reasonOf = (r: Refusal) => reason(r.code, r.cause);
// An item page's refusal notes (book-ui.md, too heavy; pass-1 E8): a locked Take reads as ownership.
export const NOTED: Record<string, string> = {
  too_heavy: REASON.too_heavy!,
  over_load: REASON.over_load!,
  permission_denied: 'not yours',
  cooldown: REASON.cooldown!, // a held tool resting between uses (pass-2 R2)
};
// A buy-page row's reason: the shop's stock is gone, or the player's purse is short.
export const BUY: Record<string, string> = {
  not_owned: 'sold out',
  insufficient_resource: "can't afford",
};
export const buyReason = (code: string) => BUY[code] ?? reason(code);
// A sell-page row's reason: the shop's own line (a fence's refusal of honest goods, pass-1 GE3), else the code's word.
export const sellReason = (
  s: { reason?: string; message?: { key: string } },
  text: (key: string) => string,
) => (s.message ? text(s.message.key) : reason(s.reason ?? ''));
// A thing a living NPC holds (pass-1 E14).
export const heldBy = (name: string) => `${name} is holding it.`;
export const balance = (pennies: number) => `You have ${pennies}p.`;
// A hostile NPC's page when its cartridge gives no refusal line (Book hostile refusal).
export const hostileRefusal = (name: string) => `${name} will have nothing to do with you.`;
// The titles of a shopkeeper's buy and sell pages (owner picks mvlymuams73l, mvlynyikyw57).
export const sellsTitle = (name: string) => `${name} can sell you…`;
export const buysTitle = (name: string) => `${name} will buy…`;
type Say = (key: string) => string;

// Compare structured TextKeys, never rendered English. Authored non-navigation consequences stay.
export const withoutHeading = <T extends { key: string }>(lines: readonly T[], view: GameView) =>
  lines.filter((t) => t.key !== view.place.title.key && t.key !== view.place.description?.key);

// A known NPC's or visible entity's name, worded.
const nameOf = (view: GameView, id: unknown, text: Say) => {
  const name =
    view.known_npcs?.find((n) => n.id === id)?.name ?? view.entities.find((n) => n.id === id)?.name;
  return name && text(name);
};

// One narration line's words: an engine key from the shared table (packages/game-view/line_words.ts), in the
// third person when its actor is a person the view, or the view before the step (one who left), names.
// A skipped combat turn (loka-x6t.30) names its status from engine line combat.skipped, actorless when
// the player skipped; an NPC's emote (G9) words from the view's emote table; a liquid line adds its
// level (pick.ts levelWords). A bound speaker's quotation reads `Nell says [to you], "..."` (book-ui.md).
export const lineWords = (
  t: { key: string; bindings?: Record<string, unknown>; participants?: Record<string, unknown> },
  text: Say,
  view: GameView,
  was?: GameView,
) => {
  const wield =
    t.key in WIELD && things(view).find((x) => x.id === t.participants?.item)?.slot === 'wield';
  const named = (id: unknown) =>
    id === undefined ? undefined : nameOf(view, id, text) || (was && nameOf(was, id, text));
  const id = t.participants?.actor;
  const actor = named(id);
  const word = (v: unknown) => text(String(v));
  const told =
    (actor && emoteSentence(t, view.emotes, word, actor)) ||
    lineSentence(t, word, actor, wield ? WIELD[t.key] : undefined);
  if (told) return told;
  if (t.key !== 'combat.skipped') {
    const said = text(t.key) + levelWords(t, text, view, was);
    const speaker = named(t.participants?.speaker);
    return speaker && /^["“][^"“”]*["”]$/.test(said)
      ? `${cap(speaker)} says${actor ? '' : ' to you'}, ${said}`
      : said;
  }
  const who = id === undefined ? 'You are' : actor ? `${actor} is` : 'They are';
  return sentence(`${who} too ${text(String(t.bindings?.status))} to do anything.`);
};

// A press that changed nothing, as one plain sentence (book-ui.md, Shared elapsed status).
const UNDONE: Partial<Record<Reply['kind'], string>> = {
  conflict: 'The book is still catching up; try again.',
  invalid: "That can't be done.",
  unauthorized: "That isn't yours to do.",
};

// What one press answers: the narration, one line per record, or the outcome's words (words.ts;
// none: no line) of an accepted command, else the refusal in words. Never a raw outcome code.
export const replyLine = (
  r: Reply,
  text: Say,
  view: GameView,
  fallback?: string,
  was?: GameView,
): DetailLine[] => [answer(r, text, view, fallback, was)].flat().filter(Boolean);
export const lineText = (l: DetailLine) => (typeof l === 'string' ? l : l.text);

function answer(
  r: Reply,
  text: Say,
  view: GameView,
  fallback?: string,
  was?: GameView,
): DetailLine | string[] {
  if (r.kind === 'stale_view') return 'The page had changed; here it is again.';
  if (r.kind !== 'saved') return UNDONE[r.kind] ?? `(${r.kind}${'code' in r ? ` ${r.code}` : ''})`;
  const d = r.decision;
  if (d.kind === 'rejected') {
    // a refused line, as a refused drag (model.ts `refused`)
    return {
      kind: 'refused',
      reason: reasonOf(d.error),
      text: refusedSentence(d.error) ?? `You can't do that—${reasonOf(d.error)}.`, // prose, no colon (Line placement)
    };
  }
  if (d.kind === 'fault') return '';
  if (d.outcome === 'located' && d.location) {
    const location = d.location;
    // novel prose, no colon label (book-ui.md, Line placement)
    const name = nameOf(view, location.target_id, text);
    const [who, is, was] = name ? [subject(name), 'is', 'was'] : ['They', 'are', 'were'];
    if (location.status === 'here') return `${who} ${is} here.`;
    if (location.status === 'unknown') return 'Their whereabouts are unknown.';
    const room = view.map?.rooms.find((r) => r.id === location.room_id);
    const ago = view.time - location.at; // a clock behind the sighting still reads just now
    return `${who} ${was} last seen at ${room ? text(room.title) : 'a previously observed place'}, ${ago < 120 ? 'just now' : `${dur(ago)} ago`}.`;
  }
  const lines = d.narration ?? [];
  const shown = ['looked', 'moved'].includes(d.outcome) ? withoutHeading(lines, view) : lines;
  const said = shown.map((t) => lineWords(t, text, view, was)).filter(Boolean);
  return said.length ? said : (fallback ?? OUTCOME[d.outcome] ?? '');
}

// The Book's echo of an accepted speech press whose receipt has no narration (book-ui.md, Word bar),
// in novel prose (Line placement): the folded word capitalised, its stop inside the quotes; no word, no echo.
export const spoken = (how: string, word: unknown, to?: string) =>
  typeof word === 'string'
    ? `You ${how}${to ? ` to ${to}` : ''}, "${sentence(word.toLowerCase())}${how === 'shout' ? '!' : '.'}"`
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

type Offered =
  | { available: true }
  | { available: false; reason: Refusal & { message?: Parameters<typeof message>[0] } };
// An offer's refusal as the Book says it: the cartridge's sentence, else the code's word; '' when offered.
export const why = (e: Offered, text: (key: string) => string) =>
  e.available ? '' : e.reason.message ? message(e.reason.message, text) : reasonOf(e.reason);
export const expeditionLine = (
  e: NonNullable<GameView['journal'][number]['expedition']>,
  text: Say,
) =>
  e.status === 'active' && e.next_title
    ? e.direction
      ? `Next you go ${e.direction} to ${text(e.next_title)}.`
      : `Your next checkpoint is ${text(e.next_title)}.`
    : '';
