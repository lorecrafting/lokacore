// The E1 witness for a toolbox row 21 repair service: the mended weapon's durability fact rises
// on its subject (an entity fact.assign of the benefit's fact).
import type { DeltaOp, ServiceDefinition } from '../src/contracts.gen.ts';
import { same } from '../src/foundation/compose.ts';

export const repaired = (
  ops: readonly DeltaOp[],
  benefit: Extract<ServiceDefinition['benefit'], { kind: 'repair' }>,
) =>
  ops.some(
    (op) =>
      op.op === 'fact.assign' &&
      same(op.fact, benefit.fact) &&
      op.subject_id !== undefined &&
      (op.value as number) > (op.expected as number),
  );
