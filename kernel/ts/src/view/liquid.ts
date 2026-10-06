import {
  LIMITS,
  type AdvertisedAction,
  type CharacterId,
  type CommandPayload,
  type EntityId,
  type LiquidView,
} from '../contracts.gen.ts';
import { KernelError } from '../foundation/error.ts';
import { bodyOf, refString, type Steps, type World } from '../runtime/decision.ts';
import { refusal, type ActionSet, type Offered } from '../commands/actions.ts';
import { transition, vesselUsable } from '../mechanics/liquid/shared.ts';

export function liquidView(world: World, id: string): { liquid: LiquidView } | undefined {
  const e = world.entities[id],
    row = world.state.liquids?.[id];
  if (e?.kind !== 'item' || !e.vessel || !row) return;
  const kind = row.kind && world.cartridge.liquids![refString(row.kind)];
  return {
    liquid: {
      ...row,
      capacity: e.vessel.capacity,
      unit_label: e.vessel.unit_label,
      label: kind ? kind.label : ('liquid.empty' as never),
    },
  };
}

export function liquidActions(
  world: World,
  actor: CharacterId,
  id: string,
  set: ActionSet,
  steps: Steps,
): AdvertisedAction[] {
  if (!world.cartridge.lock.capabilities.liquid) return [];
  const body = bodyOf(world, actor);
  if (!body) return [];
  const source = world.details[id]?.liquid_source;
  if (!source && !eligible(world, body, id as EntityId, steps)) return [];
  const ids = Object.keys(world.liquidSpecs);
  if (ids.length > LIMITS.selector_cardinality) throw new KernelError('budget_exceeded');
  const result: AdvertisedAction[] = [];
  const offers = (
    p: Extract<CommandPayload, { type: 'fill' | 'pour' | 'drink' }>,
    ids: EntityId[],
  ) =>
    Object.values(set)
      .filter((a) => a.command === p.type)
      .map((a) => shown(world, p, ids, a, set, steps));
  if (!source) {
    const p = { type: 'drink', actor_id: actor, vessel_id: id as EntityId } as const;
    result.push(...offers(p, [id as EntityId]));
  }
  for (const candidate of ids) {
    if (++steps.n > LIMITS.query_steps) throw new KernelError('budget_exceeded');
    if (candidate === id || !eligible(world, body, candidate as EntityId, steps)) continue;
    const participants = { actor_id: actor, source_id: id as EntityId };
    const p = source
      ? { ...participants, type: 'fill' as const, vessel_id: candidate as EntityId }
      : { ...participants, type: 'pour' as const, receiver_id: candidate as EntityId };
    result.push(...offers(p, [id as EntityId, candidate as EntityId]));
  }
  return result;
}

function shown(
  world: World,
  p: Extract<CommandPayload, { type: 'fill' | 'pour' | 'drink' }>,
  target_ids: EntityId[],
  a: Offered,
  set: ActionSet,
  steps: Steps,
): AdvertisedAction {
  const blocked = refusal(world, p, steps, a.key, set);
  const planned = blocked ?? transition(world, p, steps);
  const code = typeof planned === 'string' ? planned : undefined;
  if (code === 'budget_exceeded' || code === 'containment_cycle' || code === 'precondition_failed')
    throw new KernelError(code);
  const offer = {
    action_key: a.key,
    command: a.command,
    label: a.label,
    target: a.target,
    input: a.input,
    target_ids,
  };
  return code ? { ...offer, available: false, reason: { code } } : { ...offer, available: true };
}

function eligible(world: World, body: EntityId, id: EntityId, steps: Steps): boolean {
  const code = vesselUsable(world, body, id, steps);
  if (code === 'budget_exceeded' || code === 'containment_cycle' || code === 'precondition_failed')
    throw new KernelError(code);
  return !code;
}
