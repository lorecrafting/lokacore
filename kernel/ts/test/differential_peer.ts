// Differential peer for test/loka/core/compose_test.exs: composes each {state, delta} in the
// JSON file named by argv[2] and prints the canonical results and invariant outcomes.
import { readFileSync } from 'node:fs';
import { encode, type Json } from '../src/canonical.ts';
import { compose } from '../src/compose.ts';
import { check } from '../src/invariants.ts';

const { ids, cases } = JSON.parse(readFileSync(process.argv[2]!, 'utf8'));
const out = cases.map(({ state, delta }: { state: never; delta: never }) => {
  const result = compose(state, delta);
  return { result, invariants: ids.map((id: string) => check(id, { state, delta, result })) };
});
process.stdout.write(encode(out as Json));
