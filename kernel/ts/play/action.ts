// The Action card's step beyond card.ts (which is at its size ceiling): a check and its failure outcome together.
import { minimal, removed } from './card.ts';

type Obj = Record<string, unknown>;
const plain = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A scripted action whose failure outcome is there exactly when its check is (OUTCOME_MISMATCH,
 * scripted_actions.ex:109): a check brings the least failure (its words `~`), no check drops it.
 * An `extends` child is left alone: its check or failure may come from the parent (extends.ex merge).
 * A key holding undefined is absent, as it is once written to JSON. */
export function paired(doc: Obj, defs: Record<string, Obj>): Obj {
  const outcomes = doc.outcomes;
  const check = doc.check !== undefined;
  if (!plain(outcomes) || 'extends' in doc || check === (outcomes.failure !== undefined))
    return doc;
  if (!check) return { ...doc, outcomes: removed(outcomes, 'failure') };
  const at = (defs['source.ScriptedAction'].properties as Record<string, Obj>).outcomes;
  const failure = minimal((at.properties as Record<string, Obj>).failure, defs);
  return { ...doc, outcomes: { ...outcomes, failure } };
}
