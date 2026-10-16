// Toolbox row FD6, the Chronicle (book-ui.md, Chronicle details): the story's committed narration
// grouped by day, each day's lines as the away recap groups them. Nothing is stored.
import type { ChronicleEntry, GameView } from '../../packages/game-view/session.ts';
import { rendered } from './logs.ts';
import { grouped, type RecapLine } from './recap.ts';

export type ChronicleDay = { day: number; lines: RecapLine[]; milestones: Set<string> };

/** Days in entry order (ascending), each shown line once with its count; a line is a milestone
 * when any receipt that showed it on that day reached a story point. */
export function days(
  entries: readonly ChronicleEntry[],
  view: GameView,
  text: (key: string) => string,
) {
  const out: (Omit<ChronicleDay, 'lines'> & { lines: string[] })[] = [];
  for (const e of entries)
    for (const line of rendered(e.record, view, text, false)) {
      let d = out.at(-1);
      if (d?.day !== e.day) out.push((d = { day: e.day, lines: [], milestones: new Set() }));
      d.lines.push(line);
      if (e.milestone) d.milestones.add(line);
    }
  return out.map((d): ChronicleDay => ({ ...d, lines: grouped(d.lines) }));
}
