// Exact keyed admission and direct-held food transition share one bounded query.
import {
  LIMITS,
  type CommandPayload,
  type EventPayload,
  type DefinitionRef,
  type DeltaOp,
  type EntityId,
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
import { applyStatus, cureOps, statusStep } from '../status/shared.ts';
import { transition as drinkPlan } from '../liquid/shared.ts';

type Payload = Extract<CommandPayload, { type: 'consume' }>;
/** The one effect block a consumable declares (loka-kgd.209): an edible's, or a drunk liquid's. */
export type Effect = Pick<ItemEdible, 'resource' | 'amount' | 'cures' | 'applies'>;
type Plan = { ops: readonly DeltaOp[]; effect: Effect; edible?: ItemEdible; drank?: Drank };
type Drank = { kind: DefinitionRef; quantity: number };
export function availability(world: World, p: Payload, steps: Steps, action: Key) {
  const code = refusal(world, p, steps, action);
  return code ? { code: code as ErrorCode } : transition(world, p, steps);
}
// size: allow 50, an edible's own admission and a vessel's delegated drink plan share one effect
export function transition(
  world: World,
  p: Payload,
  steps: Steps = { n: 0 },
): UnavailableReason | Plan {
  if (++steps.n > LIMITS.query_steps) return { code: 'budget_exceeded' };
  const item = world.entities[p.item_id];
  // A vessel's Consume is liquid@1's Drink: its admission, its liquid's effect (loka-kgd.209).
  if (item?.kind === 'item' && item.vessel) return drink(world, p, steps);
  const body = bodyOf(world, p.actor_id);
  if (!body || (level(world, body, resourceRef(world, 'hp')) ?? 0) <= 0 || engaged(world, body))
    return { code: 'invalid_state' };
  if (!item) return { code: 'not_found' };
  if (item.kind !== 'item' || !item.edible) return { code: 'invalid_target' };
  if (world.state.containers[p.item_id] !== body) return { code: 'not_owned' };
  if (!world.consumed) return { code: 'precondition_failed' };
  const edible = item.edible;
  const restore = restored(world, body, edible);
  if (typeof restore === 'string') return { code: restore };
  const cured = cureOps(world, body, edible.cures);
  // Row hs-5: at the maximum a meal is eaten only for a status that would land on or refresh the eater.
  const lands = edible.applies?.some(
    (s) => applyStatus(world, body, s.status, 0, () => '', s.duration).length > 0,
  );
  if (!restore.length && !cured.length && !lands) return { code: 'invalid_state' };
  return {
    edible,
    effect: edible,
    ops: [
      {
        op: 'entity.transfer',
        writer_group: 0,
        entity_id: p.item_id,
        source_id: body,
        destination_id: world.consumed,
      },
      ...cured, // first, so a cure's hp settle (row 2c) reads the hp before the meal
      ...restore,
    ],
  };
}

// The effect's restore, saturated at the pool's maximum: none without a resource.
function restored(world: World, body: EntityId, { resource, amount }: Effect) {
  if (!resource) return [];
  const current = level(world, body, resource),
    spec = resourceSpec(world, body, resource);
  if (current === undefined || !spec) return 'precondition_failed' as const;
  const by = Math.min(amount!, spec.maximum - current);
  return by > 0 ? [adjust(world, body, resource, by, {}).op] : [];
}

function drink(world: World, p: Payload, steps: Steps): UnavailableReason | Plan {
  const plan = drinkPlan(
    world,
    { type: 'drink', actor_id: p.actor_id, vessel_id: p.item_id },
    steps,
  );
  if (typeof plan === 'string') return { code: plan as ErrorCode };
  const effect = world.cartridge.liquids?.[refString(plan.kind)] ?? {};
  const restore = restored(world, bodyOf(world, p.actor_id)!, effect);
  if (typeof restore === 'string') return { code: restore };
  return { effect, ops: [...plan.ops, ...restore], drank: plan };
}

type Applied = Extract<EventPayload, { type: 'status_applied' }>;
/** Row hs-5: the meal's `applies` lands on the eater's body after the restore and cures, as a
 * reaction step would (one writer group, status reader 2's event, immune, silent refresh). */
export function applied(
  world: World,
  command: Parameters<typeof event>[1],
  mint: Mint,
  { effect, ops }: Pick<Plan, 'effect' | 'ops'>,
  position = 0, // the events before these (a Consume's drank)
) {
  const body = bodyOf(world, command.payload.actor_id)!;
  const events: Event<Applied['type']>[] = [];
  const emit = (p: Applied) =>
    events.push(event(world, command, mint, position + events.length + 1, p));
  // A status the meal cures and applies is written once: the cure wins, as a spell's earlier write.
  const applied = new Set(
    ops.flatMap((o) =>
      o.op === 'status.transition' ? [`${o.body_id}|${refString(o.status)}`] : [],
    ),
  );
  const own = { holders: new Map<string, number>(), applied };
  const steps = (effect.applies ?? []).map(({ status, duration }) =>
    statusStep(world, { op: 'status.apply', status, duration }, [body], body, 0, own, mint, emit),
  );
  return {
    ops: steps.flatMap((d) => d.ops),
    events,
    lines: steps.flatMap((d) => d.narration),
  };
}
