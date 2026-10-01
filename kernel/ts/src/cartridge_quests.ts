// The loader's quest checks (quest@1; quest.schema.json QuestDefinition; 06 §2, §8 references
// exist), twin of lib/loka/content/quests.ex: each quest's key is no registered command's,
// action's or recipe's (DUPLICATE_DEFINITION: its offer is an ActionSet identity), its title and
// offer label have catalog entries, and a post_activation_event objective names an item of this
// cartridge. Its policies are walked with every other policy (cartridge_refs.ts nodes).
import { CAPABILITY_OWNERS, type Diagnostic } from './contracts.gen.ts';
import { diag, step, type Obj } from './cartridge_refs.ts';

type Checks = {
  named: (r: Obj, kind: string, path: string) => void;
  text: (def: Obj, fields: string[], at: string) => void;
};

export function quests(c: Obj, { named, text }: Checks): Diagnostic[] {
  const taken = new Set([
    ...Object.keys(CAPABILITY_OWNERS.command),
    ...[...Object.values(c.actions as Obj), ...Object.values(c.recipes ?? {})].map((d) => d.key),
  ]);
  const out: Diagnostic[] = [];
  for (const [ref, q] of Object.entries((c.quests ?? {}) as Obj)) {
    const at = `.cartridge.quests${step(ref)}`;
    if (taken.has(q.key)) out.push(diag('DUPLICATE_DEFINITION', at));
    text(q, ['title'], at);
    text(q.offer, ['label'], `${at}.offer`);
    if (q.objective.item_acquired)
      named(q.objective.item_acquired, 'item', `${at}.objective.item_acquired`);
  }
  return out;
}
