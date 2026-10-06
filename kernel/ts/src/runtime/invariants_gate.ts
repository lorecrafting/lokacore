import { same } from '../foundation/compose.ts';
import type { DeltaOp } from '../contracts.gen.ts';
import { creationsHold } from './invariants_creation.ts';
import { liquidsHold } from './invariants_liquid.ts';
import { encountersHold } from './invariants_encounter.ts';
import { escortsHold } from './invariants_escort.ts';
import { patrolsHold } from './invariants_patrol.ts';
import { populationsHold } from './invariants_population.ts';

type Any = any;
export function gate(state: Any, ops: DeltaOp[], result: Any): boolean {
  return (
    Number.isInteger(state.clock) &&
    retirementsHold(ops) &&
    creationsHold(state, ops, result) &&
    liquidsHold(state, ops, result) &&
    encountersHold(state, ops, result) &&
    escortsHold(state, ops, result) &&
    patrolsHold(state, ops, result) &&
    populationsHold(state, ops, result)
  );
}

function retirementsHold(ops: readonly DeltaOp[]): boolean {
  return ops.every((op, i) => {
    if (op.op !== 'quest.retire') return true;
    const next = ops[i + 1];
    return (
      next?.op === 'quest.activate' &&
      next.writer_group === op.writer_group &&
      next.instance_id !== op.instance_id &&
      same(next.quest, op.quest) &&
      same(next.scope, op.scope)
    );
  });
}
