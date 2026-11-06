// The Rules block's tables (docs/rnd/gui-editor-design-2026-11-04.md §4.5); its logic is card.ts.
import STEP_CONTEXTS from './step_contexts.json' with { type: 'json' };

// a field named other than its kind (content/leaf_refs.ex: a policy's or step's `with`, `plan`;
// content/reactions.ex:36: a trigger's filters)
export const PICK_NAMES: Record<string, string> = {
  services: 'service',
  items: 'item',
  with: 'npc',
  plan: 'population',
  victim: 'npc',
  attacker: 'npc',
  target: 'npc',
  witness: 'npc',
  kind: 'liquid',
};

// the step context each node kind's steps compile in (content/steps.ex `check/5` callers)
const CONTEXT: Record<string, string> = {
  reaction: 'reaction',
  action: 'action',
  dialogue: 'choice',
  service: 'service',
};

/**
 * Whether the picker offers branch `b` on a `kind` node (the inspector's selection): a step op the compiler refuses in that
 * context (content/steps.ex:14 `@ops`; a reaction's `damage`) is not; every other branch is.
 */
export function offered(b: { properties?: { op?: { const?: unknown } } }, kind: string) {
  const ctx = CONTEXT[kind];
  const op = String(b.properties?.op?.const);
  const where = (STEP_CONTEXTS as Record<string, string[]>)[op];
  return !ctx || !Object.hasOwn(STEP_CONTEXTS, op) || where.includes(ctx);
}
