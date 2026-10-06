import type { DefinitionRef, Diagnostic } from '../contracts.gen.ts';
import { refString } from '../runtime/decision.ts';
import { diag, step, type Obj } from './cartridge_refs.ts';

const ref = (r: Obj) => refString(r as DefinitionRef);

/** Loader twin of the compiler's narrow two-room, one-hound/one-pelt plan check. */
export function population(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const plans = c.populations ?? {};
  for (const [planRef, p] of Object.entries(plans) as [string, Obj][]) {
    const at = `.cartridge.populations${step(planRef)}`;
    const bundle = c.population_bundles?.[ref(p.bundle)];
    const npc = bundle && c.npcs?.[ref(bundle.npc)];
    const item = bundle && c.items?.[ref(bundle.item)];
    const corpse = bundle && c.items?.[ref(bundle.corpse)];
    const rooms = p.area.map((r: Obj) => c.rooms?.[ref(r)]);
    const calendar = c.calendar;
    const validPeriods =
      calendar &&
      p.night_start < calendar.hours_per_day &&
      p.night_end < calendar.hours_per_day &&
      p.wander_interval <= p.replacement_delay &&
      p.wander_interval % calendar.units_per_hour === 0 &&
      p.replacement_delay <= Math.floor(Number.MAX_SAFE_INTEGER / 2);
    const targets = p.day_target <= p.night_target && p.night_target <= p.cap;
    const area =
      p.area.some((r: Obj) => ref(r) === ref(p.home)) &&
      rooms.every(Boolean) &&
      reciprocal(rooms, p.area);
    const template =
      npc?.spawn_template === true &&
      ref(npc.room) === ref(p.home) &&
      npc.hp &&
      npc.attack &&
      item?.location.in === 'template' &&
      !item.container &&
      !item.capacity &&
      !item.slot &&
      !item.barrier &&
      corpse?.location.in === 'template' &&
      corpse.container === true &&
      !corpse.capacity;
    if (!bundle || !template) out.push(diag('SCHEMA_VIOLATION', `${at}.bundle`));
    if (!area) out.push(diag('SCHEMA_VIOLATION', `${at}.area`));
    if (!validPeriods) out.push(diag('SCHEMA_VIOLATION', `${at}.wander_interval`));
    if (!targets) out.push(diag('SCHEMA_VIOLATION', `${at}.day_target`));
    if (c.lock.capabilities.population !== 1)
      out.push(diag('UNDECLARED_CAPABILITY', at, { capability: 'population' }, ['population@1']));
  }
  return out;
}

function reciprocal([a, b]: Obj[], [ar, br]: Obj[]): boolean {
  if (!a || !b) return false;
  return Object.entries(a.exits ?? {}).some(
    ([direction, edge]: [string, any]) =>
      ref(edge.to) === ref(br) &&
      !edge.barrier &&
      Object.entries(b.exits ?? {}).some(
        ([back, reverse]: [string, any]) =>
          back !== direction && ref(reverse.to) === ref(ar) && !reverse.barrier,
      ),
  );
}
