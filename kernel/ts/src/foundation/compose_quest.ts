import type { DeltaOp } from '../contracts.gen.ts';
import type { Json } from './canonical.ts';
import { same, get, check, type Obj, type Outcome } from './compose.ts';

const LEGAL: Record<string, string[]> = {
  active: ['objectives_complete', 'failed', 'abandoned'],
  objectives_complete: ['resolved', 'failed', 'abandoned'],
  failed: ['active'],
  abandoned: ['active'],
};
const OPEN = ['active', 'objectives_complete'];
export function quest(
  op: DeltaOp & { op: `quest.${string}` },
  row: Json | undefined,
  entries: () => [string, Json][],
): Outcome {
  if (op.op === 'quest.retire')
    return check(
      get(row, 'state') === 'resolved' &&
        same(get(row, 'quest'), op.quest) &&
        same(get(row, 'scope'), op.scope),
      null,
    );
  if (op.op === 'quest.activate') {
    const taken = entries().some(
      ([, r]) =>
        same(get(r, 'quest'), op.quest) &&
        same(get(r, 'scope'), op.scope) &&
        OPEN.includes(get(r, 'state') as string),
    );
    const created = {
      quest: op.quest,
      scope: op.scope,
      state: 'active',
      ...(op.bindings && { bindings: op.bindings }),
    };
    return check(row === undefined && !taken, created as unknown as Json);
  }
  const outcomeOk =
    op.to === 'resolved'
      ? op.outcome !== undefined
      : op.to === 'failed' || op.outcome === undefined;
  const { outcome: _, ...rest } = (row ?? {}) as Obj;
  const next = op.outcome === undefined ? rest : { ...rest, outcome: op.outcome };
  const legal = (LEGAL[op.from] ?? []).includes(op.to);
  return check(get(row, 'state') === op.from && legal && outcomeOk, { ...next, state: op.to });
}

export function repeatPair(op: DeltaOp, next: DeltaOp | undefined): boolean {
  return (
    op.op !== 'quest.retire' ||
    !!(
      next?.op === 'quest.activate' &&
      next.writer_group === op.writer_group &&
      next.instance_id !== op.instance_id &&
      same(next.quest, op.quest) &&
      same(next.scope, op.scope)
    )
  );
}
