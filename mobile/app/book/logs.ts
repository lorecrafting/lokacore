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
import { withoutHeading } from './words.ts';
type Say = (key: string) => string;

export function narrationLines(last: NarrationRecord | undefined, view: GameView, text: Say) {
  return [false, true].map((combat) =>
    withoutHeading(
      (last?.lines ?? []).filter((_, i) => !!last?.combat_lines?.includes(i) === combat),
      view,
    )
      .map((line) => liquidLine(line, text))
      .join(' '),
  );
}

export type DetailLine = string | { text: string; event: true };
export type Logs = {
  log: string[];
  combatLog: string[];
  details: Map<string, DetailLine[]>;
  retry?: { button: Button; detail?: string; item?: string; invocation?: string };
  projection: Projection;
  status: ElapsedStatus;
  recovered?: boolean;
  narrationId?: string;
  confirmedRead?: string;
  returnWorld?: boolean;
  returnDetail?: string;
  fault?: string;
};

export function pickupLine(last: NarrationRecord | undefined, text: Say) {
  return last?.pickup_name ? `You pick up ${text(last.pickup_name)}.` : '';
}

export function restoredLogs(game: Game, text: Say): Logs {
  const last = game.lastNarration();
  const { view } = game.view();
  const [narrated, combat] = narrationLines(last, view, text);
  const restored = pickupLine(last, text) || narrated;
  const log = restored && !view.choice && !last?.detail_id ? [restored] : [];
  const details = new Map<string, DetailLine[]>();
  if (restored && last?.detail_id) details.set(last.detail_id, [restored]);
  else if (restored && view.choice)
    details.set(view.choice.speaker_id ?? 'conversation', [restored]);
  if (view.choice) {
    const id = view.choice.speaker_id ?? 'conversation';
    details.set(id, [...(details.get(id) ?? []), text(view.choice.prompt.key)]);
  }
  return {
    log,
    combatLog: combat ? [combat] : [],
    details,
    narrationId: last?.command_id,
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
  if (was.place.id !== now.place.id) s.log.length = 0;
  if (now.combat && now.combat.encounter_id !== was.combat?.encounter_id) s.combatLog.length = 0;
}

export const combatResult = (d: Extract<DecisionResult, { kind: 'accepted' }> | undefined) =>
  !!d &&
  (['engaged', 'fled'].includes(d.outcome) ||
    d.events.some((e) => e.payload.type === 'attack_result'));

function liquidLine(line: NarrationRecord['lines'][number], text: Say): string {
  const sentence = text(line.key);
  if (!['liquid.filled', 'liquid.poured', 'liquid.drank'].includes(line.key)) return sentence;
  const { kind, unit_label, quantity } = line.bindings ?? {};
  return typeof kind === 'string' &&
    typeof unit_label === 'string' &&
    Number.isSafeInteger(quantity)
    ? `${sentence}\n${text(kind)} · ${quantity} ${text(unit_label)}`
    : sentence;
}
