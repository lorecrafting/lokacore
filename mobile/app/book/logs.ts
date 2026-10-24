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
import { plain } from './model.ts';
import { lineWords, withoutHeading } from './words.ts';
type Say = (key: string) => string;

// One log line per narration record, then the cue (book-ui.md, Live action freshness; pass-1 UO):
// [World lines, combat lines].
export const narrationLines = (
  last: NarrationRecord | undefined,
  view: GameView,
  text: Say,
  past = false,
) => [
  [
    ...rendered(last, view, text, false),
    last?.cue ? `${past ? 'Earlier: ' : ''}${text(last.cue.key)}` : '',
  ].filter(Boolean),
  rendered(last, view, text, true),
];

export const rendered = (
  last: NarrationRecord | undefined,
  view: GameView,
  text: Say,
  combat: boolean,
) =>
  withoutHeading(
    (last?.lines ?? []).filter((_, i) => !!last?.combat_lines?.includes(i) === combat),
    view,
  ).map((line) => liquidLine(line, text, view));

// A refused line (a barred exit) leads with its reason tag (LogLines's doc comment).
export type DetailLine =
  string | { text: string; event: true } | { kind: 'refused'; reason: string; text: string };
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
  pickedFrom?: string; // a restored pickup's corpse, whose next visit still shows it
  fault?: string;
  // An open elapsed settlement's held World entries, one per line.
  away?: { from: number; log: string[] };
  recap?: string[]; // the away recap's lines, grouped when drawn
  ended?: GameView['combat']; // a closed encounter's page, until Back to World (book-ui.md, Closure)
  asided?: Set<string>; // the asides logged this room visit
};

export function pickupLine(last: NarrationRecord | undefined, text: Say) {
  return last?.pickup_name ? `You pick up ${text(last.pickup_name)}.` : '';
}

export function restoredLogs(game: Game, text: Say): Logs {
  const last = game.lastNarration();
  const { view } = game.view();
  const [narrated, combat] = narrationLines(last, view, text, true);
  const pickup = pickupLine(last, text);
  const restored = pickup ? [pickup] : narrated;
  const log = !view.choice && !last?.detail_id ? restored : [];
  const details = new Map<string, DetailLine[]>();
  if (restored.length && last?.detail_id) details.set(last.detail_id, restored);
  else if (restored.length && view.choice)
    details.set(view.choice.speaker_id ?? 'conversation', restored);
  if (view.choice) {
    const id = view.choice.speaker_id ?? 'conversation';
    details.set(id, [...(details.get(id) ?? []), text(view.choice.prompt.key)]);
  }
  const s: Logs = {
    log,
    combatLog: combat,
    details,
    narrationId: last?.command_id,
    pickedFrom: pickup ? last?.detail_id : undefined,
    projection: game.view(),
    status: { kind: 'ready' },
  };
  log.push(...asideLines(s, view, text));
  return s;
}

// The room's and present people's asides, in projected order, as owner-and-key ids.
const asidesOf = (view: GameView) => [
  ...(view.place.asides ?? []).map((a) => ['', a.key] as const),
  ...view.entities.flatMap((e) =>
    (e.kind === 'npc' ? (e.asides ?? []) : []).map((a) => [e.id, a.key] as const),
  ),
];

// Each aside is one plain World line the first time it shows in a room visit (book-ui.md, Aside
// details); one that stops holding and comes back is not logged again.
export function asideLines(s: Logs, view: GameView, text: Say) {
  return asidesOf(view).flatMap(([at, key]) => {
    const id = `${at} ${key}`;
    if ((s.asided ??= new Set()).has(id)) return [];
    s.asided.add(id);
    return [plain(text(key))];
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
    s.asided = new Set();
    s.away = s.recap = undefined; // held and shown recap lines belong to the room left, as its log
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

function liquidLine(line: NarrationRecord['lines'][number], text: Say, view: GameView): string {
  const sentence = lineWords(line, text, view);
  if (line.key === 'item.recovered' && typeof line.bindings?.item === 'string')
    return `${sentence} ${text(line.bindings.item)}.`;
  if (!['liquid.filled', 'liquid.poured', 'liquid.drank'].includes(line.key)) return sentence;
  const { kind, unit_label, quantity } = line.bindings ?? {};
  return typeof kind === 'string' &&
    typeof unit_label === 'string' &&
    Number.isSafeInteger(quantity)
    ? `${sentence}\n${text(kind)} · ${quantity} ${text(unit_label)}`
    : sentence;
}

export function detailLines(s: Logs, id: string) {
  if (!s.details.has(id)) s.details.set(id, []);
  return s.details.get(id)!;
}

// Drops each history whose page is not open (book-ui.md Detail-page order), so a late write for a
// closed page is gone by its next visit; a dream's (resumed, not revisited), a restored pickup's
// (until its corpse opens) and an open choice's speaker's (its question, as on a cold reopen) stay.
export function visit(s: Logs, open: (string | undefined)[]) {
  if (open.includes(s.pickedFrom)) s.pickedFrom = undefined;
  const choice = s.projection.view.choice;
  const keep = [...open, s.pickedFrom, choice && (choice.speaker_id ?? 'conversation')];
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
