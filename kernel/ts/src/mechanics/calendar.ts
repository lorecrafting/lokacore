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

/** The lunar phase at `time`, or undefined without authored lunar cuts. */
export function lunarPhase(cartridge: Cartridge, time: number): string | undefined {
  const lunar = cartridge.calendar?.lunar;
  if (!lunar) return undefined;
  return phase(
    lunar.phases,
    (((time - lunar.origin) % lunar.period) + lunar.period) % lunar.period,
  );
}

export function status(cartridge: Cartridge, time: number) {
  const calendar = cartridge.calendar;
  if (!calendar?.subdivisions_per_hour) return undefined;
  const { hour, day } = units(cartridge);
  const solar = calendar.solar;
  const lunar = lunarPhase(cartridge, time);
  const dayTime = time % day;
  return {
    day: Math.floor(time / day) + 1,
    hour: Math.floor(dayTime / hour),
    subdivision: Math.floor((dayTime % hour) / (hour / calendar.subdivisions_per_hour)),
    ...(solar && { solar: phase(solar, dayTime) }),
    ...(lunar && { lunar }),
  };
}
