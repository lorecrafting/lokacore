// Typed scoped facts (fact@1; 03 §7, §13; 21 §3.9, §4 Fact): the value an actor reads, and the
// facts_typed invariant. A world keeps each fact's default (newWorld) and the facts set since
// (State.facts, by canonical MutationTarget text, the key composition writes).
import { decode } from './canonical.ts';
import { key, same } from './compose.ts';
import type {
  CharacterId,
  Command,
  DefinitionRef,
  DeltaOp,
  DomainEvent,
  FactType,
  FactValue,
  StateScope,
} from './contracts.gen.ts';
import { event, refString, type Mint, type World } from './decision.ts';

/**
 * The scope `actor` reads and sets `fact` at: its one scope (the loader admits only player or
 * instance, FACT_SCOPE_UNSUPPORTED), the actor's for player and this world's for instance.
 */
export function scopeOf(world: World, actor: CharacterId, fact: DefinitionRef): StateScope {
  const [kind] = world.cartridge.facts[refString(fact)].scopes;
  return kind === 'player'
    ? { kind, character_id: actor }
    : { kind: 'instance', world_context_id: world.context };
}

/** The fact's value for `actor`: its record at the actor's scope (scopeOf), else its default. */
export function value(world: World, actor: CharacterId, fact: DefinitionRef): FactValue {
  const scope = scopeOf(world, actor, fact);
  return world.state.facts?.[key({ kind: 'fact', fact, scope })] ?? world.factDefaults[key(fact)];
}

/** True when `v` is of FactType `t` (the loader checks authored values with it too). */
export const typed = (v: FactValue, t: FactType): boolean =>
  t.type === 'bool'
    ? typeof v === 'boolean'
    : t.type === 'enum'
      ? (t.values as FactValue[]).includes(v)
      : Number.isSafeInteger(v) &&
        (v as number) >= (t.minimum ?? -Infinity) &&
        (v as number) <= (t.maximum ?? Infinity);

/** True when the cartridge declares `fact`, allows scope kind `scope` and `v` is of its type. */
export function typedFact(world: World, fact: DefinitionRef, scope: string, v: FactValue): boolean {
  const spec = world.cartridge.facts[refString(fact)];
  return spec !== undefined && spec.scopes.includes(scope as never) && typed(v, spec.value_type);
}

/** Registered invariants of facts (protocol/invariants.json), pure checks of a world. */
export const invariants: Readonly<Record<string, (world: World) => boolean>> = {
  facts_typed: (world) =>
    Object.entries(world.state.facts ?? {}).every(([text, v]) => {
      const { fact, scope } = decode(text) as { fact: DefinitionRef; scope: { kind: string } };
      return typedFact(world, fact, scope.kind, v);
    }),
};

type Assign = Extract<DeltaOp, { op: 'fact.assign' }>;

/**
 * `events` with a fact_changed (old, new, the fact's scope) for each of `assigns` that changes
 * its fact (owner decision, R5 S4 Q2), ids from the command's `mint` in op order, each at the
 * next causal position `events` leaves free, then after them (04 §5.2 steps 4-5): a rule whose
 * sequence assigns before it emits leaves that position (rules/action_recipe.ts). `events`
 * itself when none changes.
 */
export function factChanged(
  world: World,
  command: { readonly id: Command['id']; readonly payload: { readonly actor_id: CharacterId } },
  mint: Mint,
  assigns: readonly Assign[],
  events: readonly DomainEvent[],
): readonly DomainEvent[] {
  const taken = new Set(events.map((e) => e.position));
  let position = 0;
  const added = assigns
    .filter((o) => !same(o.expected, o.value))
    .map((o) => {
      const subject = o.subject_id === undefined ? {} : { subject_id: o.subject_id };
      const payload = {
        type: 'fact_changed',
        fact: o.fact,
        ...subject,
        old: o.expected,
        new: o.value,
      };
      do position++;
      while (taken.has(position));
      return { ...event(world, command, mint, position, payload as never), scope: o.scope };
    });
  return added.length ? [...events, ...added].sort((a, b) => a.position - b.position) : events;
}
