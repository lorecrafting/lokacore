// Exact keyed admission and direct-held food transition share one bounded query.
import {
  LIMITS,
  type CommandPayload,
  type EventPayload,
  type DeltaOp,
  type Key,
  type ItemEdible,
  type ErrorCode,
  type UnavailableReason,
} from '../../contracts.gen.ts';
import { refusal } from '../../commands/actions.ts';
import {
  bodyOf,
  event,
  refString,
  type Event,
  type Mint,
  type Steps,
  type World,
} from '../../runtime/decision.ts';
import { engaged } from '../combat/shared.ts';
import { adjust, level, resourceRef, resourceSpec } from '../resource.ts';
import { cureOps, statusStep } from '../status/shared.ts';

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
  const cured = cureOps(world, body, edible.cures);
  const by = Math.min(edible.amount, spec.maximum - current);
  // Row hs-5: a meal with `applies` is eaten at the maximum for its buff (restoring nothing).
  if (by <= 0 && !cured.length && !edible.applies?.length) return { code: 'invalid_state' };
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

type Applied = Extract<EventPayload, { type: 'status_applied' }>;
/** Row hs-5: the meal's `applies` lands on the eater's body after the restore and cures, as a
 * reaction step would (one writer group, status reader 2's event, immune, silent refresh). */
export function applied(
  world: World,
  command: Parameters<typeof event>[1],
  mint: Mint,
  { edible, ops }: { edible: ItemEdible; ops: readonly DeltaOp[] },
) {
  const body = bodyOf(world, command.payload.actor_id)!;
  const events: Event<Applied['type']>[] = [];
  const emit = (p: Applied) => events.push(event(world, command, mint, events.length + 1, p));
  // A status the meal cures and applies is written once: the cure wins, as a spell's earlier write.
  const applied = new Set(
    ops.flatMap((o) =>
      o.op === 'status.transition' ? [`${o.body_id}|${refString(o.status)}`] : [],
    ),
  );
  const own = { holders: new Map<string, number>(), applied };
  const steps = (edible.applies ?? []).map((status) =>
    statusStep(world, { op: 'status.apply', status }, [body], body, 0, own, mint, emit),
  );
  return {
    ops: steps.flatMap((d) => d.ops),
    events,
    lines: steps.flatMap((d) => d.narration),
  };
}
