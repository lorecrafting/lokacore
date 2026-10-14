// The facts_typed invariant (protocol/invariants.json) and the typed check a fact.assign or a saved
// fact row passes (fact@1; 21 §3.9): split from fact.ts, which keeps reading and writing facts.
import { decode } from '../foundation/canonical.ts';
import type { DefinitionRef, FactValue } from '../contracts.gen.ts';
import { refString, type World } from '../runtime/decision.ts';
import { npcPair, typed } from './fact.ts';

/**
 * True when the cartridge declares the fact at target `t` (a fact.assign or a decoded saved key),
 * allows `t`'s scope kind, `t` names a subject exactly when the fact is per_subject (row W2), and
 * `v` is of its type.
 */
export function typedFact(
  world: World,
  t: {
    readonly fact: DefinitionRef;
    readonly scope: { kind: string };
    readonly subject_id?: unknown;
    readonly with_id?: unknown;
  },
  v: FactValue,
): boolean {
  const spec = world.cartridge.facts[refString(t.fact)];
  return (
    spec !== undefined &&
    spec.scopes.includes(t.scope.kind as never) &&
    (spec.per_subject === true) === (t.subject_id !== undefined) &&
    (spec.npc_pair === true) === (t.with_id !== undefined) &&
    typed(v, spec.value_type)
  );
}

// Toolbox row W13: a compiler-reserved trail fact (a plan's with trail, characters' if one hunts).
const trailFact = (world: World, k: string) =>
  Object.values(world.cartridge.populations ?? {}).some(
    (p) =>
      (p.trail && (k === `trail_${p.key}_exit` || k === `trail_${p.key}_at`)) ||
      (p.hunts && (k === 'trail_exit' || k === 'trail_at')),
  );

/** Registered invariants of facts (protocol/invariants.json), pure checks of a world. */
export const invariants: Readonly<Record<string, (world: World) => boolean>> = {
  facts_typed: (world) =>
    Object.entries(world.state.facts ?? {}).every(([text, v]) => {
      const t = decode(text) as {
        fact: DefinitionRef;
        scope: { kind: string };
        subject_id?: string;
        with_id?: string;
      };
      const s = t.subject_id;
      // A subject is an NPC, item or detail (row W2); a trail fact's subject is its room (W13); a
      // pair's two are distinct NPCs (FD4).
      const known =
        s === undefined ||
        (t.with_id !== undefined
          ? npcPair(world, s, t.with_id)
          : trailFact(world, t.fact.key)
            ? Object.hasOwn(world.rooms, s)
            : Object.hasOwn(world.entities, s) || Object.hasOwn(world.details, s));
      return known && typedFact(world, t, v);
    }),
};
