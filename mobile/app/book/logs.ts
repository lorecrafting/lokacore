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
  return {
    log,
    combatLog: combat,
    details,
    narrationId: last?.command_id,
    pickedFrom: pickup ? last?.detail_id : undefined,
    projection: game.view(),
    status: { kind: 'ready' },
  };
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
    s.away = s.recap = undefined; // held and shown recap lines belong to the room left, as its log
  }
  if (now.combat && now.combat.encounter_id !== was.combat?.encounter_id) s.combatLog.length = 0;
  if (was.combat && !now.combat) s.ended = was.combat;
}

// A closing receipt's lines all end the fight on its Combat page, whatever their key (book-ui.md,
// Closure).
export const closing = (last: NarrationRecord, was: GameView, now: GameView): NarrationRecord =>
  was.combat && !now.combat ? { ...last, combat_lines: last.lines.map((_, i) => i) } : last;

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
