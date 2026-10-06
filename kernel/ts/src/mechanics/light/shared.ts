import { living } from '../death/shared.ts';
import { value } from '../fact.ts';
import {
  LIMITS,
  type CharacterId,
  type DeltaOp,
  type EntityId,
  type FuelSpec,
} from '../../contracts.gen.ts';
import { fuelAt, validFuel } from '../../foundation/fuel.ts';
import { bodyOf, refString, type Steps, type World } from '../../runtime/decision.ts';
import { darkSight } from '../attributes/shared.ts';

export const VERBS: readonly string[] = ['ignite', 'douse', 'refuel'];
const held = (w: World, body: EntityId, item: string) =>
  w.state.containers[item] === body ||
  (w.state.containers[item] === w.slots.light && w.state.containers[w.slots.light] === body);
export function fuelView(w: World, item: string) {
  const spec = w.fuelSpecs[item],
    row = w.state.fuel?.[item];
  if (!spec || !row) return undefined;
  const current = fuelAt(row, spec, w.state.clock);
  return { remaining: current.remaining, capacity: spec.capacity, lit: current.lit };
}

/** Pure transition shared by live admission, projection and historical receipt verification. */
export function transition(
  w: World,
  actor: CharacterId,
  verb: string,
  item: EntityId,
  supply?: EntityId,
) {
  const body = bodyOf(w, actor),
    spec = w.fuelSpecs[item],
    prior = w.state.fuel?.[item];
  if (!spec || spec.kind !== 'source') return 'invalid_target' as const;
  if (!body || !held(w, body, item)) return 'not_owned' as const;
  if (!validFuel(prior, spec, w.state.clock)) return 'precondition_failed' as const;
  const next = { ...fuelAt(prior, spec, w.state.clock) };
  const ops: DeltaOp[] = [];
  if (verb === 'ignite') {
    if (next.lit || next.remaining === 0) return 'invalid_state' as const;
    next.lit = true;
  } else if (verb === 'douse') {
    if (!prior.lit) return 'invalid_state' as const;
    next.lit = false;
  } else if (verb === 'refuel') {
    const refill = refillFrom(w, body, spec, next.remaining, supply);
    if (typeof refill === 'string') return refill;
    next.remaining += refill.amount;
    ops.push(refill.op);
  } else return 'invalid_target' as const;
  ops.unshift({ op: 'fuel.set', writer_group: 0, item_id: item, from: prior, to: next });
  const outcome = verb === 'ignite' ? 'ignited' : verb === 'douse' ? 'doused' : 'refueled';
  return {
    ops,
    outcome,
    narration: [
      {
        key: spec[outcome],
        participants: { item, ...(verb === 'refuel' && supply && { supply }) },
      },
    ],
  };
}

/** Bounded illumination, only directly held or in this actor's light slot. */
export function illuminated(w: World, actor: CharacterId, steps: Steps = { n: 0 }): boolean {
  const body = bodyOf(w, actor);
  if (!body) return false;
  for (const [item, spec] of Object.entries(w.fuelSpecs)) {
    if (++steps.n > LIMITS.query_steps) return false;
    if (spec.kind === 'source' && held(w, body, item) && fuelView(w, item)?.lit) return true;
  }
  return false;
}
export function dark(w: World, actor: CharacterId, steps: Steps = { n: 0 }) {
  const body = bodyOf(w, actor);
  return (
    !!body &&
    !!w.rooms[w.state.containers[body]]?.dark_description &&
    !darkSight(w, actor) &&
    !illuminated(w, actor, steps)
  );
}

/** Darkness reveals inventory and the actual owner's corpse ancestry, never foreign corpses. */
export function visible(
  w: World,
  actor: CharacterId,
  id: string,
  steps: Steps = { n: 0 },
): boolean {
  const body = bodyOf(w, actor),
    here = body && w.state.containers[body];
  const detail = w.details[id];
  const entity = w.entities[id];
  if (entity?.kind === 'npc' && entity.perception)
    return (
      living(w, id as EntityId) &&
      w.state.containers[id] === here &&
      value(w, actor, entity.perception.discovered) === true
    );
  if (!dark(w, actor, steps)) return true;
  if (detail?.room === here && detail.perception?.self_luminous) return true;
  const room = here;
  let at: string | undefined = id,
    owned = false;
  const seen = new Set<string>();
  while (at && at !== room) {
    if (++steps.n > LIMITS.query_steps || seen.has(at)) return false;
    seen.add(at);
    if (at === body) return true;
    const origin = w.state.created?.[at]?.origin;
    if (origin?.kind === 'death') {
      if (origin.owner_id !== actor) return false;
      owned = true;
    }
    at = w.state.containers[at];
  }
  return at === room && owned;
}

function refillFrom(
  w: World,
  body: EntityId,
  source: Extract<FuelSpec, { kind: 'source' }>,
  remaining: number,
  supply?: EntityId,
) {
  const fuel = supply && w.fuelSpecs[supply],
    row = supply && w.state.fuel?.[supply];
  if (
    !supply ||
    !fuel ||
    fuel.kind !== 'supply' ||
    fuel.unit !== source.unit ||
    w.entityIds[refString(source.supply)] !== supply
  )
    return 'invalid_target' as const;
  if (w.state.containers[supply] !== body) return 'not_owned' as const;
  if (!validFuel(row, fuel, w.state.clock)) return 'precondition_failed' as const;
  const amount = Math.min(source.capacity - remaining, row.remaining);
  if (amount === 0) return 'invalid_state' as const;
  const op: DeltaOp = {
    op: 'fuel.set',
    writer_group: 0,
    item_id: supply,
    from: row,
    to: { remaining: row.remaining - amount, at: w.state.clock, lit: false },
  };
  return { op, amount };
}

export function sourceSupply(w: World, source: string): EntityId | undefined {
  const spec = w.fuelSpecs[source];
  return spec?.kind === 'source' ? w.entityIds[refString(spec.supply)] : undefined;
}

export function refillSupply(w: World, actor: CharacterId, source: string): EntityId | undefined {
  const supply = sourceSupply(w, source);
  return supply && typeof transition(w, actor, 'refuel', source as EntityId, supply) !== 'string'
    ? supply
    : undefined;
}
