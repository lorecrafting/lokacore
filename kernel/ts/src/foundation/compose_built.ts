import type { DeltaOp } from '../contracts.gen.ts';
import type { Json } from './canonical.ts';
import { same, type Ctx } from './compose.ts';
import { read } from './compose_rows.ts';

type Op = Extract<DeltaOp, { op: 'built.set' }>;

/** One built room's tombstone row (Built rooms S5): expected matches, and entity_id is a created
 * row of origin kind built (an earlier entity.create of the same delta counts). */
export function setBuilt(op: Op, row: Json | undefined, ctx: Ctx) {
  const entity = read({ kind: 'entity', entity_id: op.entity_id }, ctx) as
    { origin?: { kind?: string } } | undefined;
  if (!same(row, op.expected) || entity?.origin?.kind !== 'built')
    return { code: 'precondition_failed' as const };
  return { value: op.value as unknown as Json };
}
