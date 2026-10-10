// Exact keyed admission and direct-held food transition share one bounded query.
import {
  LIMITS,
  type CommandPayload,
  type DeltaOp,
  type Key,
  type ItemEdible,
  type ErrorCode,
  type UnavailableReason,
} from '../../contracts.gen.ts';
import { refusal } from '../../commands/actions.ts';
import { bodyOf, refString, type Steps, type World } from '../../runtime/decision.ts';
import { engaged } from '../combat/shared.ts';
import { adjust, level, resourceRef, resourceSpec } from '../resource.ts';
import { activeStatuses, expire } from '../status/shared.ts';

type Payload = Extract<CommandPayload, { type: 'eat' }>;
export function availability(world: World, p: Payload, steps: Steps, action: Key) {
  const code = refusal(world, p, steps, action);
  return code ? { code: code as ErrorCode } : transition(world, p, steps);
}
export function transition(
  world: World,
  p: Payload,
  steps: Steps = { n: 0 },
): UnavailableReason | { ops: readonly DeltaOp[]; edible: ItemEdible } {
  if (++steps.n > LIMITS.query_steps) return { code: 'budget_exceeded' };
  const body = bodyOf(world, p.actor_id);
  if (!body || (level(world, body, resourceRef(world, 'hp')) ?? 0) <= 0 || engaged(world, body))
    return { code: 'invalid_state' };
  const item = world.entities[p.item_id];
  if (!item) return { code: 'not_found' };
  if (item.kind !== 'item' || !item.edible) return { code: 'invalid_target' };
  if (world.state.containers[p.item_id] !== body) return { code: 'not_owned' };
  if (!world.consumed) return { code: 'precondition_failed' };
  const edible = item.edible,
    current = level(world, body, edible.resource),
    spec = resourceSpec(world, body, edible.resource);
  if (current === undefined || !spec) return { code: 'precondition_failed' };
  // Each active status once, however often `cures` lists it.
  const cures = new Set((edible.cures ?? []).map(refString));
  const cured = activeStatuses(world, body)
    .filter(({ status }) => cures.has(refString(status)))
    .flatMap(({ status, row }) => expire(world, body, status, row, 0));
  const by = Math.min(edible.amount, spec.maximum - current);
  if (by <= 0 && cured.length === 0) return { code: 'invalid_state' };
  return {
    edible,
    ops: [
      {
        op: 'entity.transfer',
        writer_group: 0,
        entity_id: p.item_id,
        source_id: body,
        destination_id: world.consumed,
      },
      ...cured, // first, so a cure's hp settle (row 2c) reads the hp before the meal
      ...(by > 0 ? [adjust(world, body, edible.resource, by, {}).op] : []),
    ],
  };
}
