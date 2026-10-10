// Authored calendar validation at the cartridge trust boundary.
import type { Diagnostic } from '../contracts.gen.ts';
import { diag, nodes, step, type Obj } from './cartridge_refs.ts';
import { apiCmp } from './cartridge_installed.ts';

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
  tables(cal, invalid);
  for (const [ref, npc] of Object.entries((c.npcs ?? {}) as Obj))
    for (const key of Object.keys(npc.daily_schedule ?? {}))
      if (Number(key) >= hours) invalid(`.cartridge.npcs${step(ref)}.daily_schedule${step(key)}`);
  for (const [p, path] of nodes(c))
    if (p.op === 'time_window' && (p.from >= hours || p.to >= hours)) invalid(path);
  out.push(...sky(c, invalid));
  return out;
}

const CYCLES = ['lunar', 'season', 'tide'] as const;
const ROW31 = ['weather', 'season', 'tide'];

// The lunar, season and tide cycles (row 31 adds the last two) and the weather table's unique phases.
function tables(cal: Obj | undefined, invalid: (path: string) => void) {
  // Row 31 tables show on the status line, which needs the expanded calendar's units.
  if (ROW31.some((f) => cal?.[f]) && cal?.subdivisions_per_hour === undefined)
    invalid('.cartridge.calendar');
  for (const name of CYCLES)
    if (cal?.[name]) {
      const { origin, period, phases } = cal[name];
      if (!Number.isSafeInteger(origin + period)) invalid(`.cartridge.calendar.${name}`);
      cuts(phases, period, `.cartridge.calendar.${name}.phases`, invalid, true);
    }
  const weathers = new Set<string>();
  (cal?.weather ?? []).forEach((w: Obj, i: number) => {
    if (weathers.has(w.phase)) invalid(`.cartridge.calendar.weather[${i}]`);
    weathers.add(w.phase);
  });
}

// Toolbox rows 10 and 31: each sky leaf names a phase its calendar table authors; it, the row 31
// tables and a barrier's opens_when need API 1.45.
function sky(c: Obj, invalid: (path: string) => void): Diagnostic[] {
  const cal = c.calendar;
  const table = (f: string): Obj[] => (f === 'weather' ? cal?.weather : cal?.[f]?.phases) ?? [];
  const leaves = nodes(c).filter(([p]) => p.op === 'sky');
  for (const [p, path] of leaves)
    for (const f of [...CYCLES, 'weather'])
      if (p[f] !== undefined && !table(f).some((cut) => cut.phase === p[f]))
        invalid(`${path}.${f}`);
  const gated =
    leaves.length > 0 ||
    ROW31.some((f) => cal?.[f]) ||
    Object.values((c.barriers ?? {}) as Obj).some((b) => b.opens_when);
  return gated && apiCmp(c.manifest.requires.kernel_api.at_least, '1.45') < 0
    ? [diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least')]
    : [];
}
