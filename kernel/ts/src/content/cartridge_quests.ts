// Quest policy roots for cartridge_refs.ts nodes; quest checks are the compiler's (quests.ex).
import { step, type Obj } from './cartridge_refs.ts';

export function questPolicies(c: Obj): [Obj, string][] {
  return Object.entries((c.quests ?? {}) as Obj).flatMap(([ref, q]) => {
    const at = `.cartridge.quests${step(ref)}`;
    return [
      ...['offer', 'objective']
        .filter((f) => q[f]?.policy)
        .map((f): [Obj, string] => [q[f].policy.root, `${at}.${f}.policy.root`]),
      ...(q.journal?.active_variants ?? []).map((v: Obj, i: number): [Obj, string] => [
        v.when.root,
        `${at}.journal.active_variants[${i}].when.root`,
      ]),
    ];
  });
}
