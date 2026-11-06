// The NPC and Item cards' Combat and Schedule blocks (docs/rnd/gui-editor-design-2026-11-04.md §4.2,
// §4.3): what they write and read; the blocks draw only (tools/author-panel/src/edit/blocks/).
import type { FightsReport, Section } from './numbers.ts';
import type { Ui } from './ui_schema.ts';

type Schedule = Record<string, unknown>;

/** A schedule's hours in the order of the day (keys are hour numbers, not sorted as text). */
export const hours = (schedule: Schedule) =>
  Object.entries(schedule).sort(([a], [b]) => Number(a) - Number(b));

/**
 * `schedule` with hour `from` moved to `to`, keeping its order, or why not: an hour is a whole number
 * below the calendar's `hours_per_day` (calendar.ex schedules/3) and not one the schedule has.
 */
export function rehour(schedule: Schedule, from: string, to: string, perDay?: number) {
  if (!/^(0|[1-9][0-9]*)$/.test(to)) return 'an hour is a whole number';
  if (perDay !== undefined && Number(to) >= perDay) return `an hour is below ${perDay}`;
  if (to !== from && Object.hasOwn(schedule, to)) return `already ${to}`;
  return Object.fromEntries(Object.entries(schedule).map(([h, v]) => [h === from ? to : h, v]));
}

/** `schedule` with its first free hour sending the NPC to `room` (its own); undefined when none is free. */
export function addHour(schedule: Schedule, room: unknown, perDay?: number) {
  if (typeof room !== 'string' || !room) return undefined; // nothing invented: the author places it first
  for (let h = 0; perDay === undefined || h < perDay; h++)
    if (!Object.hasOwn(schedule, String(h))) return { ...schedule, [String(h)]: room };
  return undefined;
}

/** The NPC `key`'s fight rows in GET /numbers, or why the report did not run; none when it has no attack. */
export const fightOf = (fights: Section<FightsReport>, key: string) =>
  'why' in fights
    ? fights.why
    : fights.report.targets.find((t) => t.target.endsWith(`:npc/${key}`));

/** An hour's walker ui with its room keys (a lone room, a case list's fallback) drawn by the room picker. */
export function roomPicks(ui: Ui): Ui {
  const each = (b: Ui): Ui =>
    b?.['ui:title'] === 'Key'
      ? { ...b, 'ui:field': 'DefinitionRef' }
      : b?.items
        ? { ...b, items: roomPicks(b.items) }
        : b;
  return { ...ui, anyOf: ui.anyOf?.map(each) };
}
