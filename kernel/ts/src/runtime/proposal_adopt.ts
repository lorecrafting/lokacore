import { encode } from '../foundation/canonical.ts';
import { apply, base } from './apply.ts';
import { counts, over, target, type Limit } from '../foundation/compose.ts';
import type { DecisionResult, DeltaOp } from '../contracts.gen.ts';
import type { Mint, Steps, World } from './decision.ts';
import { typedFact } from '../mechanics/fact.ts';
import { utf8 } from '../foundation/sha256.ts';
import { recoveryFault } from '../mechanics/resource.ts';
import { propose, BUDGET, type Actor } from './proposal.ts';
import type { Admitted } from './proposal_admit.ts';
export type Stepped = { decision: DecisionResult; world: World; limit?: Limit };
type Assign = Extract<DeltaOp, { op: 'fact.assign' }>;
/** Compose one admitted proposal atomically. Validate typed facts, whole-proposal budgets,
 * recovery metadata and choice revision stamps before adopting state and hydrated maps.
 * A fault discards every change, including the proposal-local RNG.
 */
export function adopt(
  world: World,
  decision: Admitted,
  command: Actor,
  mint: Mint,
  revision: number,
  steps: Steps = { n: 0 },
): Stepped {
  const { decision: out, limit } = propose(world, decision, command, mint, steps);
  if (out.kind !== 'accepted') return faulted(out, world, limit);
  const assigns = out.delta.ops.filter((o) => o.op === 'fact.assign') as Assign[];
  const bad = assigns.find((o) => !typedFact(world, o, o.value));
  if (bad)
    return { decision: { kind: 'fault', code: 'precondition_failed', target: target(bad) }, world };
  // Every limit of the whole proposal in one call, so a tie names the first in 04 §5.4 order.
  const spent = over({
    ...counts(base(world), out.delta.ops),
    query_steps: steps.n,
    events: out.events.length,
    output_bytes: utf8(encode(out as never)).length,
  });
  if (spent) return faulted(BUDGET, world, spent);
  const applied = apply(world, out.delta.ops);
  if ('fault' in applied) return faulted(applied.fault, world, applied.limit);
  const resource = recoveryFault({ ...world, state: applied.state }, out.delta.ops);
  if (resource)
    return { decision: { kind: 'fault', code: 'precondition_failed', target: resource }, world };
  let choices = applied.state.choices;
  for (const o of out.delta.ops)
    if (o.op === 'choice.open') {
      const row = { ...choices![o.continuation_id]!, opened_revision: revision };
      choices = { ...choices, [o.continuation_id]: row };
    }
  const state = { ...applied.state, ...(choices && { choices }), rng: out.rng } as World['state'];
  return { decision: out, world: { ...applied.world, state } };
}

const faulted = (decision: DecisionResult, world: World, limit?: Limit): Stepped => ({
  decision,
  world,
  ...(limit && { limit }),
});
