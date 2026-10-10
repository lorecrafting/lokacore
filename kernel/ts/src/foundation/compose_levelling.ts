import type { DeltaOp } from '../contracts.gen.ts';
import type { Json } from './canonical.ts';
import { same } from './compose.ts';

type Op = Extract<DeltaOp, { op: 'levelling.set' }>;

/** One character's levelling row (toolbox row 4): expected matches, and nothing falls. */
export function setLevelling(op: Op, row: Json | undefined) {
  const prior = (row ?? { experience: 0, allocated: {} }) as Op['value'];
  const next = op.value;
  const kept = Object.entries(prior.allocated).every(([a, n]) => (next.allocated[a] ?? 0) >= n);
  if (!same(row ?? null, op.expected) || next.experience < prior.experience || !kept)
    return { code: 'precondition_failed' as const };
  return { value: next as unknown as Json };
}
