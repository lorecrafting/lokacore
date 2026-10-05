import type { Cartridge } from '../runtime/decision.ts';

// Historical cartridges retain their installed clock until their content is advanced.
export const LEGACY_HOUR = 3600;
export const LEGACY_DAY_HOURS = 24;

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

export function status(cartridge: Cartridge, time: number) {
  const calendar = cartridge.calendar;
  if (!calendar?.subdivisions_per_hour) return undefined;
  const { hour, day } = units(cartridge);
  const solar = calendar.solar;
  const lunar = calendar.lunar;
  const dayTime = time % day;
  const phase = (cuts: readonly { at: number; phase: string }[], at: number) => {
    let selected = cuts.at(-1)!;
    for (const cut of cuts)
      if (cut.at <= at) selected = cut;
      else break;
    return selected.phase;
  };
  const lunarTime = lunar && (((time - lunar.origin) % lunar.period) + lunar.period) % lunar.period;
  return {
    day: Math.floor(time / day) + 1,
    hour: Math.floor(dayTime / hour),
    subdivision: Math.floor((dayTime % hour) / (hour / calendar.subdivisions_per_hour)),
    ...(solar && { solar: phase(solar, dayTime) }),
    ...(lunar && { lunar: phase(lunar.phases, lunarTime!) }),
  };
}
