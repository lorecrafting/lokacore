// E1 witness for a reaction's named barrier.set step (row W22, Beads loka-kgd.103), hooked into
// reactionWitnesses (e1_obligations.ts is at its size cap): the transition that ends the named
// barrier at `to`, the committed barrier there, and its barrier_changed caused by the trigger.
// ponytail: a tag step names no barrier, so it has no witness; bind it to the event room's tagged
// exits when chapter content authors one.
import type { DeltaOp, ReactionRule } from '../src/contracts.gen.ts';
import type { World } from '../src/index.ts';
import { same } from '../src/foundation/compose.ts';
import { barrierState } from '../src/mechanics/lookups.ts';

type BarrierSet = Extract<ReactionRule['apply'][number], { op: 'barrier.set' }>;

/** The op the step authors: its named barrier's transition into `to`. */
export const barrierOp = (ops: readonly DeltaOp[], step: BarrierSet) =>
  step.barrier
    ? ops.find(
        (o) => o.op === 'barrier.transition' && same(o.barrier, step.barrier) && o.to === step.to,
      )
    : undefined;

/** The op's writer group when the committed barrier is at `to` and the delivery emitted its change. */
export const barrierGroup = (
  after: World,
  step: BarrierSet,
  op: DeltaOp | undefined,
  caused: (want: Record<string, unknown>) => boolean,
) =>
  op?.op === 'barrier.transition' &&
  barrierState(after, op.barrier) === step.to &&
  caused({ type: 'barrier_changed', barrier: op.barrier, to: step.to })
    ? op.writer_group
    : undefined;
