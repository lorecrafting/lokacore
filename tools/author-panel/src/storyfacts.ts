// The Facts table (docs/design/story-tooling.md F1 and W4): every declared fact as one row, with its
// type, default, scope, meaning, set count, read count, status and reachable range, worst first.
// No React here: tested from kernel/ts/test/author_facts.test.ts.
import type { FactUsage } from '../../../kernel/ts/play/fact_usage.ts';
import type { Story } from './storylist.ts';

export type FactRow = FactUsage & {
  range: string; // W4: `min..max`, empty when the fact cannot be bounded
  label: string; // every column in order, for the row's accessible text
};

/** W4's reachable range, as `min..max`. The ceiling is L2a's sum (`lib/loka/content/lint_facts.ex`:
 * the default plus every positive `fact.adjust`); L2a computes **no floor**, so the floor is the
 * fact's declared `minimum` and nothing is invented from negative adjusts. A fact lacking either
 * side renders empty, which is honest: an unbounded int has no range to show. */
export const range = (f: FactUsage): string =>
  f.value_type.type === 'int' && f.value_type.minimum !== undefined
    ? `${f.value_type.minimum}..${f.reach}`
    : '';

/** F1's table in its sort (`factUsage`): worst first, then by key. */
export function factRows(s: Story): FactRow[] {
  return (s.facts ?? []).map((f) => {
    const v = f.value_type;
    const cells = [
      f.key,
      v.type,
      JSON.stringify(v.default),
      f.scopes.join(', '),
      f.meaning ?? '',
      String(f.write), // `set`: the writes, which `write` already counts
      String(f.read),
      f.status,
      range(f),
    ];
    return { ...f, range: range(f), label: cells.join(' · ') };
  });
}
