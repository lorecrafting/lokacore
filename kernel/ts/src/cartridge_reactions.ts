// The loader's reaction checks (reaction@1; reaction.schema.json ReactionRule; 06 §14: referenced
// facts and targets are compile-validated), twin of lib/loka/content/reactions.ex: what each
// reaction uses, for the lock stage (cartridge.ts): its own kind, its trigger's event and each
// fact.assign's fact_changed; and its references: its trigger names a fact or room of this
// cartridge, and each fact.assign a fact of it with a value of its type. Its `when` is walked
// with every other policy (cartridge_refs.ts nodes).
import type { Diagnostic, FactValue } from './contracts.gen.ts';
import { step, type Obj } from './cartridge_refs.ts';

const each = (c: Obj): [Obj, string][] =>
  Object.entries((c.reactions ?? {}) as Obj).map(([ref, r]) => [
    r,
    `.cartridge.reactions${step(ref)}`,
  ]);

/** Each owner reference of each reaction: [registry field, name, path]. */
export const uses = (c: Obj) =>
  each(c).flatMap(([r, at]) => [
    ['definition', 'reaction', at],
    ['event', r.on.event, `${at}.on.event`],
    ...r.apply.map((_: Obj, i: number) => ['event', 'fact_changed', `${at}.apply[${i}].op`]),
  ]) as ['definition' | 'event', string, string][];

type Checks = {
  named: (r: Obj, kind: string, path: string) => void;
  typedValue: (fact: Obj, v: FactValue, path: string) => void;
};

export function reactions(c: Obj, { named, typedValue }: Checks): Diagnostic[] {
  for (const [r, at] of each(c)) {
    if (r.on.fact) named(r.on.fact, 'fact', `${at}.on.fact`);
    if (r.on.room) named(r.on.room, 'room', `${at}.on.room`);
    r.apply.forEach((s: Obj, i: number) => {
      named(s.fact, 'fact', `${at}.apply[${i}].fact`);
      typedValue(s.fact, s.value, `${at}.apply[${i}].value`);
    });
  }
  return [];
}
