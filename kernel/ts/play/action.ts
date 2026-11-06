// The Action card's step beyond card.ts (which is at its size ceiling): a check and its failure outcome together.
import { minimal, removed } from './card.ts';

type Obj = Record<string, unknown>;
const plain = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A scripted action whose failure outcome is there exactly when its check is (OUTCOME_MISMATCH,
 * scripted_actions.ex:109): a check brings the least failure (its words `~`), no check drops it. */
export function paired(doc: Obj, defs: Record<string, Obj>): Obj {
  const outcomes = doc.outcomes;
  if (!plain(outcomes) || Object.hasOwn(doc, 'check') === Object.hasOwn(outcomes, 'failure'))
    return doc;
  if (!Object.hasOwn(doc, 'check')) return { ...doc, outcomes: removed(outcomes, 'failure') };
  const at = (defs['source.ScriptedAction'].properties as Record<string, Obj>).outcomes;
  const failure = minimal((at.properties as Record<string, Obj>).failure, defs);
  return { ...doc, outcomes: { ...outcomes, failure } };
}
