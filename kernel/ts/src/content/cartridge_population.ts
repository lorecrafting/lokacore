import type { DefinitionRef, Diagnostic } from '../contracts.gen.ts';
import { refString } from '../runtime/decision.ts';
import { diag, step, type Obj } from './cartridge_refs.ts';

const ref = (r: Obj) => refString(r as DefinitionRef);
const opposite: Record<string, string> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
  up: 'down',
  down: 'up',
};

/** Loader twin of the compiler's narrow two-room, one-hound/one-pelt plan check. */
export function population(c: Obj): Diagnostic[] {
  const out: Diagnostic[] = [];
  const plans = c.populations ?? {};
  for (const [planRef, p] of Object.entries(plans) as [string, Obj][]) {
    const at = `.cartridge.populations${step(planRef)}`;
    const bundle = c.population_bundles?.[ref(p.bundle)];
    const rooms = p.area.map((r: Obj) => c.rooms?.[ref(r)]);
    const validPeriods = periods(p, c.calendar);
    const targets = p.day_target <= p.night_target && p.night_target <= p.cap;
    const area =
      ref(p.area[0]) !== ref(p.area[1]) &&
      p.area.some((r: Obj) => ref(r) === ref(p.home)) &&
      rooms.every(Boolean) &&
      reciprocal(rooms, p.area);
    const template = bundle && templateValid(c, bundle, p.home, !!p.scavenge);
    if (!packValid(c, p, rooms)) out.push(diag('SCHEMA_VIOLATION', `${at}.pack.narration`));
    if (!sightValid(c, p, rooms, bundle))
      out.push(diag('SCHEMA_VIOLATION', `${at}.sight.narration`));
    if (!bundle || !template) out.push(diag('SCHEMA_VIOLATION', `${at}.bundle`));
    if (!scavengeValid(c, p, bundle)) out.push(diag('SCHEMA_VIOLATION', `${at}.scavenge`));
    if (!area) out.push(diag('SCHEMA_VIOLATION', `${at}.area`));
    if (!validPeriods) out.push(diag('SCHEMA_VIOLATION', `${at}.wander_interval`));
    if (!targets) out.push(diag('SCHEMA_VIOLATION', `${at}.day_target`));
    if (c.lock.capabilities.population !== 1)
      out.push(diag('UNDECLARED_CAPABILITY', at, { capability: 'population' }, ['population@1']));
  }
  return out;
}

function sightValid(c: Obj, p: Obj, rooms: Obj[], bundle?: Obj): boolean {
  const sight = p.sight;
  if (!sight) return true;
  const directions: string[] = rooms.flatMap((room: Obj) =>
    room
      ? Object.entries(room.exits ?? {})
          .filter(([, edge]: [string, any]) => p.area.some((r: Obj) => ref(r) === ref(edge.to)))
          .map(([direction]) => direction)
      : [],
  );
  return (
    bundle?.member_role === 'deer' &&
    bundle.loot_role === 'hide' &&
    sight.delay > 0 &&
    directions.every((direction) => sight.narration[direction]) &&
    Object.values(sight.narration).every((key) => c.text?.[key as string])
  );
}

function packValid(c: Obj, p: Obj, rooms: Obj[]): boolean {
  const narration = p.pack?.narration;
  if (!narration) return true;
  const directions: string[] = rooms.flatMap((room: Obj) =>
    room
      ? Object.entries(room.exits ?? {})
          .filter(([, edge]: [string, any]) => p.area.some((r: Obj) => ref(r) === ref(edge.to)))
          .map(([direction]) => direction)
      : [],
  );
  return (
    directions.every((direction) => narration.enemy_fled[direction]) &&
    [
      ...Object.values(narration.enemy_fled),
      narration.helper_joined,
      narration.primary_changed,
      narration.pack_withdrew,
    ].every((key) => c.text?.[key as string])
  );
}

function periods(p: Obj, calendar?: Obj): boolean {
  return (
    !!calendar &&
    p.night_start < calendar.hours_per_day &&
    p.night_end < calendar.hours_per_day &&
    p.wander_interval <= p.replacement_delay &&
    p.wander_interval % calendar.units_per_hour === 0 &&
    p.replacement_delay <= Math.floor(Number.MAX_SAFE_INTEGER / 2)
  );
}

function templateValid(c: Obj, bundle: Obj, home: Obj, allowEmpty: boolean): boolean {
  const npc = c.npcs?.[ref(bundle.npc)];
  const item = bundle.item && c.items?.[ref(bundle.item)];
  const corpse = c.items?.[ref(bundle.corpse)];
  return (
    ((bundle.member_role === undefined && bundle.loot_role === undefined) ||
      (bundle.member_role === 'deer' && bundle.loot_role === 'hide')) &&
    (!!bundle.item || allowEmpty) &&
    npc?.spawn_template === true &&
    ref(npc.room) === ref(home) &&
    !!npc.hp &&
    !!npc.attack &&
    (!bundle.item ||
      (item?.location.in === 'template' &&
        !item.container &&
        !item.capacity &&
        !item.slot &&
        !item.barrier)) &&
    corpse?.location.in === 'template' &&
    corpse.container === true &&
    !corpse.capacity
  );
}

function scavengeValid(c: Obj, p: Obj, bundle: Obj): boolean {
  const s = p.scavenge;
  if (!s) return true;
  const corridor: Obj[] = s.corridor;
  const rooms: Obj[] = corridor.map((r) => c.rooms?.[ref(r)]);
  const nest = c.items?.[ref(s.nest)];
  const narration = s.narration;
  if (
    !bundle ||
    bundle.item ||
    !Object.values(narration).every((k) => typeof c.text?.[k as string] === 'string') ||
    new Set(corridor.map(ref)).size !== corridor.length ||
    !corridor.some((r) => ref(r) === ref(p.home)) ||
    !s.drop_rooms.every((r: Obj) => corridor.some((cr) => ref(cr) === ref(r))) ||
    !s.items.every((r: Obj) => c.items?.[ref(r)]?.location.in === 'room') ||
    nest?.container !== true ||
    !Number.isSafeInteger(nest.capacity) ||
    nest.location.in !== 'room' ||
    ref(nest.location.room) !== ref(corridor.at(-1)!) ||
    rooms.some((r) => !r)
  )
    return false;
  return corridor
    .slice(0, -1)
    .every((from, i) =>
      Object.entries(rooms[i].exits ?? {}).some(
        ([direction, edge]: [string, any]) =>
          ref(edge.to) === ref(corridor[i + 1]) &&
          !edge.barrier &&
          Object.entries(rooms[i + 1].exits ?? {}).some(
            ([back, reverse]: [string, any]) =>
              back === opposite[direction] && ref(reverse.to) === ref(from) && !reverse.barrier,
          ),
      ),
    );
}

function reciprocal([a, b]: Obj[], [ar, br]: Obj[]): boolean {
  if (!a || !b) return false;
  return Object.entries(a.exits ?? {}).some(
    ([direction, edge]: [string, any]) =>
      ref(edge.to) === ref(br) &&
      !edge.barrier &&
      Object.entries(b.exits ?? {}).some(
        ([back, reverse]: [string, any]) =>
          back === opposite[direction] && ref(reverse.to) === ref(ar) && !reverse.barrier,
      ),
  );
}
