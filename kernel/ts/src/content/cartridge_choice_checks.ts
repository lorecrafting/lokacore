// The loader's dialogue choice checks (toolbox row 14; dialogue.schema.json DialogueCheck), twin of
// lib/loka/content/choice_checks.ex: a checked choice needs kernel_api 1.47 and check@1 (its
// check_passed, content/cartridge_dialogues.ts uses), its key is no recipe's or other choice's
// check's (DUPLICATE_DEFINITION), its skill, attribute and failure text resolve, it names exactly
// one of rating and npc (SCHEMA_VIOLATION invalid_value), its npc as a recipe check's (row G3), and
// it carries only label, narration, sequence, availability and check, in a dialogue with no quest
// and no riddle, with no skill.acquire step (OUTCOME_MISMATCH at the check): a failure closes the
// conversation with nothing of the choice applied, so nothing else may hang on it.
import type { Diagnostic } from '../contracts.gen.ts';
import { apiCmp } from './cartridge_installed.ts';
import { checkKeys, rater } from './cartridge_recipes.ts';
import { diag, type Checks, type Obj } from './cartridge_refs.ts';

const PLAIN = new Set(['label', 'narration', 'sequence', 'availability', 'check']);

/** The kernel_api floor of any choice check (once per cartridge). */
export const choiceCheckFloor = (c: Obj): Diagnostic[] =>
  Object.values((c.dialogues ?? {}) as Obj).some((d) =>
    Object.values(d.choices as Obj).some((o) => o.check),
  ) && apiCmp(c.manifest.requires.kernel_api.at_least, '1.47') < 0
    ? [diag('KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least')]
    : [];

export function choiceCheck(o: Obj, path: string, d: Obj, c: Obj, { named, text }: Checks) {
  const k = o.check;
  if (!k) return [];
  const at = `${path}.check`;
  const out: Diagnostic[] = [];
  if (checkKeys(c).filter((key) => key === k.key).length > 1)
    out.push(diag('DUPLICATE_DEFINITION', at));
  if (k.skill) named(k.skill, 'skill', `${at}.skill`);
  if (k.attribute) named(k.attribute, 'attribute', `${at}.attribute`);
  text(k, ['failure'], at);
  if ((k.rating === undefined) === (k.npc === undefined))
    out.push(diag('SCHEMA_VIOLATION', at, { error: 'invalid_value' }));
  else if (k.npc) out.push(...rater(c, k, at, named));
  if (
    d.quest ||
    d.riddle ||
    Object.keys(o).some((f) => !PLAIN.has(f)) ||
    (o.sequence ?? []).some((s: Obj) => s.op === 'skill.acquire')
  )
    out.push(diag('OUTCOME_MISMATCH', at));
  return out;
}
