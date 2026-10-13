// The E1 witness for a toolbox row 20b claim or cancel: the commission's order marker closes (a
// fact.assign of its fact to false).
import type { DeltaOp, ServiceDefinition } from '../src/contracts.gen.ts';
import type { World } from '../src/index.ts';
import { same } from '../src/foundation/compose.ts';
import { refString } from '../src/runtime/decision.ts';

export const closed = (
  before: World,
  ops: readonly DeltaOp[],
  benefit: Extract<ServiceDefinition['benefit'], { kind: 'claim' | 'cancel' }>,
) => {
  const order = before.cartridge.services?.[refString(benefit.service)]?.benefit;
  return (
    order?.kind === 'entitlement' &&
    ops.some((op) => op.op === 'fact.assign' && same(op.fact, order.fact) && op.value === false)
  );
};
