// Exact initial member and same-group flight/death proof for encounter composition.
import { encode, type Json } from './canonical.ts';
import { populationRow } from './compose_population.ts';
import type { Ctx, Obj, State, Written } from './compose.ts';

const key = (value: Json) => encode(value);
const get = (value: Json | undefined, name: string): Json | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Obj)[name] : undefined;
const section = (state: State, name: string): Obj => (state[name] ?? {}) as Obj;
const containment = (id: string) => ({ kind: 'containment', entity_id: id }) as const;
const read = (target: Json, ctx: Ctx): Json | undefined => {
  const written = ctx.overlay.get(key(target));
  if (written) return written.value;
  if (get(target, 'kind') === 'containment')
    return section(ctx.state, 'containers')[get(target, 'entity_id') as string];
  return populationRow(target as never, ctx.state);
};

export function packMemberRemains(
  id: string,
  room: string,
  group: number,
  due: Json | undefined,
  ctx: Ctx,
): boolean {
  const origin = get(section(ctx.state, 'created')[id], 'origin') as Obj | undefined;
  if (origin?.kind !== 'spawned' || !packMemberInitiallyPresent(id, room, ctx.state)) return false;
  const target = {
    kind: 'population_slot',
    plan: origin.by as never,
    slot: origin.slot as number,
  } as const;
  const slot = read(target, ctx);
  const current =
    read(containment(id), ctx) === room &&
    get(slot, 'member_id') === id &&
    get(slot, 'generation') === origin.generation &&
    get(slot, 'replacement_due') === null;
  if (current) return true;
  const slotWrite = ctx.overlay.get(key(target));
  return !(
    flightProven(id, room, group, due, target, ctx) ||
    deathProven(id, group, origin, slotWrite, slot, ctx)
  );
}

function flightProven(
  id: string,
  room: string,
  group: number,
  due: Json | undefined,
  target: { kind: 'population_slot'; plan: never; slot: number },
  ctx: Ctx,
) {
  const moved = ctx.overlay.get(key(containment(id)));
  const slotWrite = ctx.overlay.get(key(target));
  const slot = read(target, ctx);
  const before = populationRow(target, ctx.state);
  return (
    moved?.group === group &&
    moved.value !== room &&
    slotWrite?.group === group &&
    Number.isSafeInteger(due) &&
    get(slot, 'last_flight_at') === due &&
    get(before, 'last_flight_at') !== due &&
    get(slot, 'replacement_due') === null
  );
}

function deathProven(
  id: string,
  group: number,
  origin: Obj,
  slotWrite: Written | undefined,
  slot: Json | undefined,
  ctx: Ctx,
) {
  const hp = ctx.overlay.get(
    key({
      kind: 'resource',
      entity_id: id,
      resource: { ...(origin.by as Obj), kind: 'resource', key: 'hp' },
    }),
  );
  return (
    slotWrite?.group === group &&
    hp?.group === group &&
    get(slot, 'replacement_due') !== null &&
    get(hp.value, 'value') === 0
  );
}

export function packMemberInitiallyPresent(id: string, room: string, state: State): boolean {
  const origin = get(section(state, 'created')[id], 'origin') as Obj | undefined;
  if (origin?.kind !== 'spawned') return false;
  const slot = populationRow(
    { kind: 'population_slot', plan: origin.by as never, slot: origin.slot as number },
    state,
  );
  return (
    section(state, 'containers')[id] === room &&
    get(slot, 'member_id') === id &&
    get(slot, 'generation') === origin.generation &&
    get(slot, 'replacement_due') === null
  );
}
