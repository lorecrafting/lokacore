// Typed scoped facts (fact@1; 03 §7, §13; 21 §3.9, §4 Fact): the value an actor reads, and the
// facts_typed invariant. A world keeps each fact's default (newWorld) and the facts set since
// (State.facts, by canonical MutationTarget text, the key composition writes).
import { KernelError } from '../foundation/error.ts';
import { add } from '../foundation/int.ts';
import { decode } from '../foundation/canonical.ts';
import { key, same } from '../foundation/compose.ts';
import type {
  CharacterId,
  DefinitionRef,
  DeltaOp,
  DomainEvent,
  FactType,
  FactValue,
  StateScope,
} from '../contracts.gen.ts';
import { refString, type Mint, type World } from '../runtime/decision.ts';

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

/** A sequence run so far: its ops, last causal position and facts as set so far (by target text). */
export type Assigned = {
  readonly ops: readonly DeltaOp[];
  readonly position: number;
  readonly facts: Readonly<Record<string, FactValue>>;
};

/**
 * `r` with one authored fact.assign step of `actor` appended (a recipe outcome's or a dialogue
 * choice's sequence): a delta fact.assign at the fact's scope whose expected value is the fact as
 * the steps before it left it; one that changes its fact leaves the next causal position free for
 * the fact_changed the host puts there (runtime/proposal.ts).
 */
export function assigned<R extends Assigned>(
  world: World,
  actor: CharacterId,
  r: R,
  s: { readonly fact: DefinitionRef; readonly value: FactValue },
  owner?: 'skills' | 'patrol' | 'service' | 'scene',
): R {
  ownership(world, s.fact, owner);
  const scope = scopeOf(world, actor, s.fact);
  const at = key({ kind: 'fact', fact: s.fact, scope });
  const expected = Object.hasOwn(r.facts, at) ? r.facts[at]! : value(world, actor, s.fact);
  const op = {
    op: 'fact.assign',
    writer_group: 0,
    fact: s.fact,
    scope,
    expected,
    value: s.value,
  } as const;
  const position = r.position + (same(expected, s.value) ? 0 : 1);
  return { ...r, ops: [...r.ops, op], position, facts: { ...r.facts, [at]: s.value } };
}

function ownership(
  world: World,
  ref: DefinitionRef,
  owner?: 'skills' | 'patrol' | 'service' | 'scene',
) {
  if (
    owner !== 'skills' &&
    Object.values(world.cartridge.skills ?? {}).some(
      (skill) =>
        ref.key === `skill_${skill.key}` || (skill.growth && ref.key === `uses_${skill.key}`),
    )
  )
    throw new KernelError('precondition_failed');
  if (
    owner !== 'patrol' &&
    Object.values(world.cartridge.quests ?? {}).some(
      (q) => q.patrol && same(q.patrol.trust_fact, ref),
    )
  )
    throw new KernelError('precondition_failed');
  if (
    owner !== 'service' &&
    Object.values(world.cartridge.services ?? {}).some(
      (service) => service.benefit.kind === 'entitlement' && same(service.benefit.fact, ref),
    )
  )
    throw new KernelError('precondition_failed');
  if (
    owner !== 'scene' &&
    Object.values(world.cartridge.scenes ?? {}).some(
      (scene) =>
        scene.control === 'presentation_only' &&
        (same(scene.on.rest.credit, ref) || scene.on_end.assign.some((a) => same(a.fact, ref))),
    )
  )
    throw new KernelError('precondition_failed');
}

/** Dialogue bounded adjustment lowers to the existing assignment and sequence overlay. */
export function adjusted<R extends Assigned>(
  world: World,
  actor: CharacterId,
  run: R,
  step: { readonly fact: DefinitionRef; readonly amount: number },
): R | undefined {
  const spec = world.cartridge.facts[refString(step.fact)];
  const type = spec?.value_type;
  const reserved =
    (step.fact.key === 'position' && world.cartridge.lock.capabilities.position) ||
    (world.cartridge.lock.capabilities.scene &&
      Object.values(world.cartridge.scenes ?? {}).some(
        (scene) => step.fact.key === `scene_${scene.key}`,
      ));
  if (
    reserved ||
    type?.type !== 'int' ||
    !Number.isSafeInteger(type.minimum) ||
    !Number.isSafeInteger(type.maximum) ||
    type.minimum! > type.maximum! ||
    !Number.isSafeInteger(step.amount)
  )
    return;
  const at = key({ kind: 'fact', fact: step.fact, scope: scopeOf(world, actor, step.fact) });
  const current = Object.hasOwn(run.facts, at)
    ? run.facts[at]
    : Object.hasOwn(world.state.facts ?? {}, at)
      ? world.state.facts![at]
      : world.factDefaults[key(step.fact)];
  if (!typed(current, type)) return;
  const next = Math.min(
    type.maximum!,
    Math.max(type.minimum!, add(current as number, step.amount)),
  );
  return assigned(world, actor, run, { fact: step.fact, value: next });
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

/** What a sequence's fact_changed events share: its world, cause, correlation, time and actor. */
export type Base = Pick<
  DomainEvent,
  'world_context_id' | 'actor_id' | 'logical_time' | 'causation_id' | 'correlation_id'
>;

/**
 * `events` with a fact_changed (old, new, the fact's scope) for each of `assigns` that changes
 * its fact (owner decision, R5 S4 Q2), each `base` with its id from the sequence's `mint` in op
 * order, at the next causal position `events` leaves free, then after them (04 §5.2 steps 4-5):
 * a rule whose sequence assigns before it emits leaves that position (mechanics/action_recipe/rule.ts).
 * `events` itself when none changes.
 */
export function factChanged(
  base: Base,
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
      return { id: mint() as DomainEvent['id'], ...base, scope: o.scope, position, payload };
    });
  return added.length
    ? [...events, ...(added as DomainEvent[])].sort((a, b) => a.position - b.position)
    : events;
}
