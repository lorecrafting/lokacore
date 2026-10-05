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
      .map((line) => text(line.key))
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
  returnWorld?: boolean;
  fault?: string;
};

export function restoredLogs(game: Game, text: Say): Logs {
  const last = game.lastNarration();
  const { view } = game.view();
  const [restored, combat] = narrationLines(last, view, text);
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

export function savedNarration(game: Game, s: Logs) {
  try {
    return game.lastNarration();
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
