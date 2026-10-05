// Authored calendar validation at the cartridge trust boundary.
import type { Diagnostic } from '../contracts.gen.ts';
import { diag, nodes, step, type Obj } from './cartridge_refs.ts';

function cuts(
  values: Obj[] | undefined,
  span: number,
  path: string,
  invalid: (path: string) => void,
  firstZero = false,
) {
  if (!values) return;
  const seen = new Set<string>();
  if (firstZero && values[0].at !== 0) invalid(path);
  values.forEach((cut, i) => {
    if (cut.at >= span || (i > 0 && cut.at <= values[i - 1].at) || seen.has(cut.phase))
      invalid(`${path}[${i}]`);
    seen.add(cut.phase);
  });
}

// Calendar values cross the cartridge trust boundary before schedules or views consume them.
export function calendarStage(c: Obj): Diagnostic[] {
  const cal = c.calendar;
  const hour = cal?.units_per_hour ?? 3600;
  const hours = cal?.hours_per_day ?? 24;
  const subdivisions = cal?.subdivisions_per_hour;
  const out: Diagnostic[] = [];
  const invalid = (path: string) =>
    out.push(diag('SCHEMA_VIOLATION', path, { error: 'not_in_enum' }));
  if (
    cal &&
    [cal.units_per_hour, cal.hours_per_day, subdivisions].some((n) => n !== undefined) &&
    [cal.units_per_hour, cal.hours_per_day, subdivisions].some((n) => n === undefined)
  )
    invalid('.cartridge.calendar');
  const day = hour * hours;
  if (
    !Number.isSafeInteger(day) ||
    (subdivisions !== undefined && hour % subdivisions !== 0) ||
    (cal && !Number.isSafeInteger(cal.start + day))
  )
    invalid('.cartridge.calendar');
  cuts(cal?.solar, day, '.cartridge.calendar.solar', invalid);
  if (cal?.lunar) {
    if (!Number.isSafeInteger(cal.lunar.origin + cal.lunar.period))
      invalid('.cartridge.calendar.lunar');
    cuts(cal.lunar.phases, cal.lunar.period, '.cartridge.calendar.lunar.phases', invalid, true);
  }
  for (const [ref, npc] of Object.entries((c.npcs ?? {}) as Obj))
    for (const key of Object.keys(npc.daily_schedule ?? {}))
      if (Number(key) >= hours) invalid(`.cartridge.npcs${step(ref)}.daily_schedule${step(key)}`);
  for (const [p, path] of nodes(c))
    if (p.op === 'time_window' && (p.from >= hours || p.to >= hours)) invalid(path);
  return out;
}
