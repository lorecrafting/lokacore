// reaction@1 (capability_registry.json; reaction.schema.json ReactionRule; 21 §3.4, §11; 06
// §14; 04 §5.2): the rules an event triggers and one delivery's explicit sequence. proposal.ts
// propose runs the FIFO queue, numbers the writer groups and counts the budgets.
import type {
  CharacterId,
  DeltaOp,
  DomainEvent,
  EventPayload,
  FactValue,
  ReactionRule,
} from './contracts.gen.ts';
import { key } from './compose.ts';
import { refString, type World } from './decision.ts';
import { scopeOf, value } from './fact.ts';
import { holds } from './policy.ts';
import { cmp } from './validate.ts';

type Payload<T> = Extract<EventPayload, { type: T }>;

/**
 * The cartridge's rules whose trigger `e` meets (its event type, and the fact that changed or the
 * room entered), in rule-key order (UTF-8 bytes; 04 §5.2 step 6), never the map's order.
 * ponytail: scans every rule per event; index them by event type when cartridges have many.
 */
export function triggered(world: World, e: DomainEvent): ReactionRule[] {
  const meets = ({ on }: ReactionRule) =>
    on.event === e.payload.type &&
    (on.event === 'fact_changed'
      ? key(on.fact) === key((e.payload as Payload<'fact_changed'>).fact)
      : world.roomIds[refString(on.room)] ===
        (e.payload as Payload<'entity_entered_room'>).room_id);
  return Object.values(world.cartridge.reactions ?? {})
    .filter(meets)
    .sort((a, b) => cmp(a.key, b.key));
}

/**
 * `rule`'s sequence for its delivery of `cause` as writer group `group`, or undefined when its
 * `when` fails, read for `actor` on the proposal `world` at the cause's logical time (04 §5.2 step
 * 5; §5.4: events keep their visited time). Each fact.assign is at the one scope its fact allows
 * for `actor`, expecting the value the proposal and the steps before it leave. Each policy leaf
 * the `when` evaluates adds one to `steps.n`.
 */
export function sequence(
  world: World,
  actor: CharacterId,
  rule: ReactionRule,
  cause: DomainEvent,
  group: number,
  steps: { n: number },
): DeltaOp[] | undefined {
  const then = { ...world, state: { ...world.state, clock: cause.logical_time } };
  if (rule.when && !holds(then, actor, rule.when.root, steps)) return undefined;
  const set: Record<string, FactValue> = {};
  return rule.apply.map(({ fact, value: v }) => {
    const scope = scopeOf(world, actor, fact);
    const at = key({ kind: 'fact', fact, scope });
    const expected = Object.hasOwn(set, at) ? set[at] : value(world, actor, fact);
    set[at] = v;
    return { op: 'fact.assign', writer_group: group, fact, scope, expected, value: v };
  });
}
