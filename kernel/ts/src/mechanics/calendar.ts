import type { CalendarCycle } from '../contracts.gen.ts';
import { sha256, utf8 } from '../foundation/sha256.ts';
import type { Cartridge } from '../runtime/decision.ts';

// Historical cartridges retain their installed clock until their content is advanced.
const LEGACY_HOUR = 3600;
const LEGACY_DAY_HOURS = 24;

export function units(cartridge: Cartridge) {
  const hour = cartridge.calendar?.units_per_hour ?? LEGACY_HOUR;
  const hours = cartridge.calendar?.hours_per_day ?? LEGACY_DAY_HOURS;
  return { hour, hours, day: hour * hours };
}

export function hourOf(cartridge: Cartridge, time: number): number {
  const { hour, hours } = units(cartridge);
  return Math.floor(time / hour) % hours;
}

export function nextHour(
  cartridge: Cartridge,
  schedule: Readonly<Record<string, unknown>>,
  time: number,
) {
  const { hour, day } = units(cartridge);
  const start = time - (time % day);
  return Math.min(
    ...Object.keys(schedule).map((h) => {
      const at = start + Number(h) * hour;
      return at > time ? at : at + day;
    }),
  );
}

// The phase of the last cut starting at or before `at` (cuts are ordered; a first cut after 0 wraps).
function phase(cuts: readonly { at: number; phase: string }[], at: number) {
  let selected = cuts.at(-1)!;
  for (const cut of cuts)
    if (cut.at <= at) selected = cut;
    else break;
  return selected.phase;
}

const cycle = (c: CalendarCycle | undefined, time: number) =>
  c && phase(c.phases, (((time - c.origin) % c.period) + c.period) % c.period);

/** The calendar day's weather entry (toolbox row 31): weighted by a hash of the world id and the
 * day number, never the authority RNG, so the same world and day always give the same weather. */
export function weather(cartridge: Cartridge, context: string, time: number) {
  const table = cartridge.calendar?.weather;
  if (!table) return undefined;
  const day = Math.floor(time / units(cartridge).day) + 1;
  const h = new DataView(sha256(utf8(`weather:${context}:${day}`)).buffer).getUint32(0);
  let roll = h % table.reduce((sum, w) => sum + w.weight, 0);
  return table.find((w) => (roll -= w.weight) < 0)!;
}

const SKY = ['lunar', 'weather', 'season', 'tide'] as const;
export type SkyField = (typeof SKY)[number];

/** One derived sky field at `time` (toolbox rows 10 and 31), or undefined when not authored. */
export function skyPhase(cartridge: Cartridge, context: string, time: number, field: SkyField) {
  return field === 'weather'
    ? weather(cartridge, context, time)?.phase
    : cycle(cartridge.calendar?.[field], time);
}

/** The derived sky at `time`: each authored table's current phase, never stored or ticked. */
export function sky(cartridge: Cartridge, context: string, time: number) {
  return Object.fromEntries(
    SKY.map((f) => [f, skyPhase(cartridge, context, time, f)]).filter(([, v]) => v),
  ) as Partial<Record<SkyField, string>>;
}

export function status(cartridge: Cartridge, context: string, time: number) {
  const calendar = cartridge.calendar;
  if (!calendar?.subdivisions_per_hour) return undefined;
  const { hour, day } = units(cartridge);
  const solar = calendar.solar;
  const dayTime = time % day;
  return {
    day: Math.floor(time / day) + 1,
    hour: Math.floor(dayTime / hour),
    subdivision: Math.floor((dayTime % hour) / (hour / calendar.subdivisions_per_hour)),
    ...(solar && { solar: phase(solar, dayTime) }),
    ...sky(cartridge, context, time),
  };
}
