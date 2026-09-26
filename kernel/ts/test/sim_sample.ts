// The simulator's real proposals for test/loka/core/compose_test.exs: prints, as JSON, the
// first argv[2] accepted decisions with delta ops from seeds 1, 2, ..., each as {state, delta}
// with its composition base state (sim.ts base), so both composes run on real deltas. Generated
// on every run, so it follows the generator and the kernel with no committed sample.
import { step } from '../src/world.ts';
import { base, simulate } from './sim.ts';

const want = Number(process.argv[2]);
const cases: unknown[] = [];
for (let seed = 1; cases.length < want; seed++) {
  const o = simulate(seed);
  let world = o.start;
  for (const c of o.commands) {
    const { decision, world: after } = step(world, c);
    if (decision.kind === 'accepted' && decision.delta.ops.length && cases.length < want)
      cases.push({ state: base(world), delta: decision.delta });
    world = after;
  }
}
process.stdout.write(JSON.stringify(cases));
