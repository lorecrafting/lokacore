// Typed scoped facts (fact@1; 03 §7, §13; 21 §3.9, §4 Fact): the value an actor reads, and the
// facts_typed invariant. A world keeps each fact's default (newWorld) and the facts set since
// (State.facts, by canonical MutationTarget text, the key composition writes).
import { decode } from './canonical.ts';
import { key } from './compose.ts';
import type { CharacterId, DefinitionRef, FactType, FactValue } from './contracts.gen.ts';
import { refString, type World } from './decision.ts';

/**
 * The fact's value for `actor`: its record at the one scope it allows (the loader admits only
 * player or instance, FACT_SCOPE_UNSUPPORTED), the actor's for player and this world's for
 * instance, else its default.
 */
export function value(world: World, actor: CharacterId, fact: DefinitionRef): FactValue {
  const [kind] = world.cartridge.facts[refString(fact)].scopes;
  const scope =
    kind === 'player'
      ? { kind, character_id: actor }
      : { kind: 'instance', world_context_id: world.context };
  return world.state.facts?.[key({ kind: 'fact', fact, scope })] ?? world.factDefaults[key(fact)];
}

const typed = (v: FactValue, t: FactType): boolean =>
  t.type === 'bool'
    ? typeof v === 'boolean'
    : t.type === 'enum'
      ? (t.values as FactValue[]).includes(v)
      : Number.isSafeInteger(v) &&
        (v as number) >= (t.minimum ?? -Infinity) &&
        (v as number) <= (t.maximum ?? Infinity);

/** Registered invariants of facts (protocol/invariants.json), pure checks of a world. */
export const invariants: Readonly<Record<string, (world: World) => boolean>> = {
  facts_typed: (world) =>
    Object.entries(world.state.facts ?? {}).every(([text, v]) => {
      const { fact, scope } = decode(text) as { fact: DefinitionRef; scope: { kind: never } };
      const spec = world.cartridge.facts[refString(fact)];
      return spec !== undefined && spec.scopes.includes(scope.kind) && typed(v, spec.value_type);
    }),
};
