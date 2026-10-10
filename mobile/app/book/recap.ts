// Toolbox row W27, the away recap (book-ui.md, Away recap): while the cartridge authors a threshold,
// an elapsed settlement's World lines are held until it settles, then shown as one grouped block
// when it spanned the threshold, else as the ordinary log. Nothing is stored.
import type { GameView } from '../../packages/game-view/session.ts';
import type { Logs } from './logs.ts';

export type RecapLine = { line: string; count: number };

/** One group per distinct shown line, in first-seen order, with how often it was seen. */
export function grouped(lines: readonly string[]): RecapLine[] {
  const counts = new Map<string, number>();
  for (const line of lines) counts.set(line, (counts.get(line) ?? 0) + 1);
  return [...counts].map(([line, count]) => ({ line, count }));
}

/**
 * Where a background update's World lines go: the open settlement's, when a threshold is authored
 * and no press is retained (a press during catch-up ends the recap; its lines log in order).
 */
export function holding(s: Logs, was: GameView, now: GameView): string[] | undefined {
  if (now.recap_after === undefined || s.retry) return undefined;
  s.away ??= { from: was.time, lines: [] };
  return s.away.lines;
}

/** Once time stops catching up: the recap if the settlement spanned the threshold, else the log. */
export function settle(s: Logs) {
  const away = s.away;
  if (!away || s.status.kind === 'catching_up') return;
  s.away = undefined;
  const { time, recap_after } = s.projection.view;
  if (
    s.status.kind === 'ready' &&
    recap_after !== undefined &&
    away.lines.length > 0 &&
    time - away.from >= recap_after
  )
    s.recap = [...(s.recap ?? []), ...away.lines]; // a second absence before a press adds to it
  else s.log.push(...away.lines);
}

/** A press ends an open settlement: its held lines go to the log before the press's own. */
export function pressedAway(s: Logs) {
  if (s.away) s.log.push(...s.away.lines);
  s.away = s.recap = undefined;
}
