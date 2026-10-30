// Separate committed combat history from ordinary room/detail narration.
import type {
  Game,
  GameView,
  Projection,
  ElapsedStatus,
  NarrationRecord,
  DecisionResult,
} from '../../packages/game-view/session.ts';
import type { Button } from './presenter.ts';
import { cueLine } from './model.ts';
import { lineText, lineWords, withoutHeading } from './words.ts';
type Say = (key: string) => string;

// One log line per narration record, then the cue (book-ui.md, Live action freshness; pass-1 UO):
// [World lines, combat lines].
export const narrationLines = (
  last: NarrationRecord | undefined,
  view: GameView,
  text: Say,
  past = false,
  was?: GameView,
) => [
  [
    ...rendered(last, view, text, false, was),
    last?.cue ? `${past ? 'Earlier: ' : ''}${text(last.cue.key)}` : '',
  ].filter(Boolean),
  rendered(last, view, text, true, was),
];

export const rendered = (
  last: NarrationRecord | undefined,
  view: GameView,
  text: Say,
  combat: boolean,
  was?: GameView,
) =>
  withoutHeading(
    (last?.lines ?? []).filter((_, i) => !!last?.combat_lines?.includes(i) === combat),
    view,
  ).map((line) => fullLine(line, text, view, was));

// A refused line (a barred exit) leads with its reason tag (LogLines's doc comment); a quiet line
// keeps its structured identity and count, `text` with " (N times)" once merged (logLines); an away
// recap (recap.ts) holds its settlement's lines, `text` its heading.
export type DetailLine =
  | string
  | { text: string; event: true }
  | { kind: 'refused'; reason: string; text: string }
  | { quiet: string; plain: string; times: number; text: string }
  | { recap: string[]; text: string };
export type Logs = {
  log: DetailLine[];
  combatLog: DetailLine[];
  details: Map<string, DetailLine[]>;
  retry?: { button: Button; detail?: string; item?: string; to?: string; invocation?: string };
  left?: string; // Leave pressed with this speaker's choice open: history cleared once the close commits
  projection: Projection;
  status: ElapsedStatus;
  recovered?: boolean;
  narrationId?: string;
  confirmedRead?: string;
  returnWorld?: boolean;
  returnDetail?: string;
  visits?: number; // the page visit a quiet line belongs to, counted when the open pages change
  open?: string;
  merged?: string[]; // quiet lines merged since the last screen, read again by the live region
  fault?: string;
  // An open elapsed settlement's held World entries, one per line.
  away?: { from: number; log: string[] };
  ended?: GameView['combat']; // a closed encounter's page, until Back to World (book-ui.md, Closure)
  noted?: Set<string>; // the cue lines logged this room visit
};

// The display table (book-ui.md Line placement): the player's own buy, sale, take or put, its
// receipt routed to the page it was pressed on, is quiet. Its identity is structured: key, bindings,
// actor, pressed target and page visit. A receipt here is the player's own press, so its one line
// is theirs (another person's action never comes back as the press's receipt).
const QUIET = ['commerce.bought', 'commerce.sold', 'item.taken', 'item.put'];
export function quietOf(
  s: Logs,
  lines: NarrationRecord['lines'] | undefined,
  target?: unknown,
  page?: string,
) {
  const l = lines?.length === 1 ? lines[0]! : undefined;
  // A take or put pressed on the item's own page is in place: quiet is a container's page only.
  const own = Array.isArray(target) && l?.key.startsWith('item.') && target[0] === page;
  if (l && QUIET.includes(l.key) && !own)
    return JSON.stringify([l.key, l.bindings, l.participants?.actor, target, s.visits]);
}

// Every line lands in the room log; `page` (the open page's history) keeps it in place too, unless
// it is quiet: then it is the room log's only, and merges into an equal quiet line just before it.
export function logLines(s: Logs, lines: DetailLine[], page?: DetailLine[], quiet?: string) {
  if (!quiet || !page || lines.length !== 1) {
    page?.push(...lines);
    s.log.push(...lines);
    return;
  }
  const plain = lineText(lines[0]!);
  const last = s.log.at(-1);
  if (typeof last !== 'object' || !('quiet' in last) || last.quiet !== quiet)
    return void s.log.push({ quiet, plain, times: 1, text: plain });
  last.times++;
  last.text = `${plain} (${last.times} times)`;
  (s.merged ??= []).push(plain);
}

export function restoredLogs(game: Game, text: Say): Logs {
  const last = game.lastNarration();
  const { view } = game.view();
  const [narrated, combat] = narrationLines(last && arrived(last), view, text, true);
  const s: Logs = {
    log: [],
    combatLog: [],
    details: new Map(),
    narrationId: last?.command_id,
    projection: game.view(),
    status: { kind: 'ready' },
  };
  const speaker = view.choice && (view.choice.speaker_id ?? 'conversation');
  const page = last?.detail_id ?? speaker;
  if (last?.read && page) detailLines(s, page).push(...narrated);
  else
    logLines(
      s,
      narrated,
      page ? detailLines(s, page) : undefined,
      quietOf(s, last?.lines, last?.detail_id),
    );
  logLines(s, combat, s.combatLog);
  // A talk receipt already holds its prompt (received.ts conversationLines guards the same way).
  if (speaker && !last?.lines.some((l) => l.key === view.choice!.prompt.key))
    detailLines(s, speaker).push(text(view.choice!.prompt.key));
  s.log.push(...cueLines(s, view, text));
  return s;
}

// Each sense cue is one plain World line the first time it shows in a room visit (book-ui.md,
// Sense cues details); one that stops and comes back is not logged again.
export function cueLines(s: Logs, view: GameView, text: Say) {
  return (view.cues ?? []).flatMap((c) => {
    const line = cueLine(c, text);
    if ((s.noted ??= new Set()).has(line)) return [];
    s.noted.add(line);
    return [line];
  });
}

export function savedNarration(game: Game, s: Logs, command_id?: string) {
  try {
    return game.lastNarration(command_id);
  } catch (e) {
    s.fault = `Saved result; narration recovery unavailable: ${(e as Error).message}`;
  }
}

export function resetLogs(s: Logs, now: GameView) {
  const was = s.projection.view;
  if (was.place.id !== now.place.id) {
    s.log.length = 0;
    s.noted = new Set();
    s.away = undefined; // held lines belong to the room left, as its log
  }
  if (now.combat && now.combat.encounter_id !== was.combat?.encounter_id) s.combatLog.length = 0;
  if (was.combat && !now.combat) s.ended = was.combat;
}

// A closing receipt's lines all end the fight on its Combat page, whatever their key (book-ui.md,
// Closure); so do a spell's cast in the fight (a foe line's Cast a spell…, loka-x6t.109.5).
export const closing = (
  last: NarrationRecord,
  was: GameView,
  now: GameView,
  cast = false,
): NarrationRecord =>
  was.combat && (!now.combat || cast)
    ? { ...last, combat_lines: last.lines.map((_, i) => i) }
    : last;

export const combatResult = (d: Extract<DecisionResult, { kind: 'accepted' }> | undefined) =>
  !!d &&
  (['engaged', 'fled'].includes(d.outcome) ||
    d.events.some((e) => e.payload.type === 'attack_result'));

function fullLine(
  line: NarrationRecord['lines'][number],
  text: Say,
  view: GameView,
  was?: GameView,
): string {
  const sentence = lineWords(line, text, view, was);
  if (line.key === 'item.recovered' && typeof line.bindings?.item === 'string')
    return `${sentence} ${text(line.bindings.item)}.`;
  return sentence;
}

export function detailLines(s: Logs, id: string) {
  if (!s.details.has(id)) s.details.set(id, []);
  return s.details.get(id)!;
}

// Drops each history whose page is not open (book-ui.md Detail-page order), so a late write for a
// closed page is gone by its next visit; a dream's (resumed, not revisited) and an open choice's
// speaker's (its question, as on a cold reopen) stay. A change of open pages is a new visit.
export function visit(s: Logs, open: (string | undefined)[]) {
  const at = JSON.stringify(open);
  if (at !== s.open) s.visits = (s.visits ?? 0) + 1;
  s.open = at;
  const choice = s.projection.view.choice;
  const keep = [...open, choice && (choice.speaker_id ?? 'conversation')];
  for (const id of s.details.keys())
    if (!keep.includes(id) && !id.startsWith('dream:')) s.details.delete(id);
}

// Leave the conversation: a fresh history; an open choice's waits for its close to commit.
export function leaveLog(s: Logs, id: string, open: boolean) {
  if (open) s.left = id;
  else s.details.get(id)?.splice(0);
}

// The committed close of that Leave empties the history; a refused one keeps the question.
export function closedLog(s: Logs, accepted: boolean) {
  if (s.retry?.button.action_key !== 'close_choice' || !s.left) return;
  if (accepted) s.details.get(s.left)?.splice(0);
  s.left = undefined;
}

// A flight's or a death's lines stay with the fight; the room reached opens at its arrival line
// (book-ui.md Line placement, loka-glj8), cut by record index before any line is worded.
// No line from the arrival on belongs to the fight left behind.
export const arrived = (last: NarrationRecord): NarrationRecord =>
  last.arrival ? { ...last, lines: last.lines.slice(last.arrival), combat_lines: undefined } : last;
