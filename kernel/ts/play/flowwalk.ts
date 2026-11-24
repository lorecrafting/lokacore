// The Flow focus walk's model (docs/rnd/in-game-builder-mode-2026-11-19.md decision 9 as amended):
// what leads to a node, what it unlocks and, for a fact, its thread, through the Flow filters.
// No React; tested from kernel/ts/test/author_flowwalk.test.ts.
import { laneOf, shownOf } from './flow.ts';
import { followed } from './flowread.ts';
import { reads } from './reads.ts';
import { fromRef, type Story } from './storylist.ts';

/** The walk around `ref`: `above` what leads to it, `below` what it unlocks (design §7 5.5; a fact
 * read is flipped, so a fact's setters are above it and its readers below),
 * `thread` a fact's setters then readers ([] for any other kind); lane refs only (an anchor is
 * not a node), deduped in edge order, kept by the Flow `filters` (FILTERS entries). */
export function walk(s: Story, ref: string, filters: string[] = []) {
  const keep = (refs: string[]) =>
    shownOf(
      s,
      { fold: [], filters },
      [...new Set(refs)].filter((r) => r !== ref && laneOf(r)),
    );
  const edges = s.graph.edges.map((e) =>
    fromRef(e.to)?.kind === 'fact' && reads(!!e.set, fromRef(e.from)?.kind)
      ? { from: e.to, to: e.from }
      : e,
  );
  return {
    above: keep(edges.filter((e) => e.to === ref).map((e) => e.from)),
    below: keep(edges.filter((e) => e.from === ref).map((e) => e.to)),
    thread: fromRef(ref)?.kind === 'fact' ? keep([...followed(s, ref)]) : [],
  };
}
