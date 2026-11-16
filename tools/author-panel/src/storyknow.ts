// Knowledge and Pacing (docs/design/editor-map-and-story-rulings.md S2; gui-editor-design 5e, 6): what a
// beat can know and each part's written mass. No React here: tested from kernel/ts/test/author_story.test.ts.
import { outlineOf, type Edge, type Story } from './storylist.ts';

export type Known = { knows: string[]; may: string[]; not: string[] };
const choiceOf = (e: Edge) => /^\.choices(?:\.([^.[]+)|\["([^"]+)"\])/.exec(e.path)?.slice(1).join('');
/** Knowledge at beat `n` (design 5e): the facts set and topics granted by nodes bound to beats up to
 * it in outline order; `may` when one choice among several sets it or a false assign up to n also clears it,
 * `not` when only a later beat sets it. A fact only ever set false up to n is not listed as known. */
export function knowledge(s: Story, n: number): Known {
  const beats = outlineOf(s)?.beats ?? [];
  const upto = beats.findIndex((b) => b.n === n);
  if (upto < 0) return { knows: [], may: [], not: [] }; // a beat gone from the outline knows nothing
  const first = new Map<string, number>(); // a node's first beat, by outline index
  beats.forEach((b, i) => b.nodes.forEach((r) => first.has(r) || first.set(r, i)));
  // ponytail: a set behind a dashed read and a readable item's topic are not told apart (design 5e); add when the outline has one
  const bound = s.graph.edges.filter((e) => first.has(e.from));
  const sets = bound.filter((e) => (e.set && !e.cleared) || e.op === 'topic.grant');
  // set false at or before n as well as true: it may hold either way, so `may` (re-review S1)
  const cleared = new Set(bound.filter((e) => e.cleared && first.get(e.from)! <= upto).map((e) => e.to));
  // every choice of the dialogue sets it, or no choice scopes it (an on_end, a reaction, a site)
  const sure = (e: Edge) =>
    !choiceOf(e) ||
    new Set(sets.filter((x) => x.from === e.from && x.to === e.to).map(choiceOf)).size >= (s.choices[e.from] ?? 0);
  const knows = new Set<string>();
  const may = new Set<string>();
  const later = new Set<string>();
  for (const e of sets) (first.get(e.from)! > upto ? later : sure(e) && !cleared.has(e.to) ? knows : may).add(e.to);
  const sorted = (xs: Set<string>, minus: Set<string>[]) => [...xs].filter((x) => !minus.some((m) => m.has(x))).sort();
  return { knows: sorted(knows, []), may: sorted(may, [knows]), not: sorted(later, [knows, may]) };
}

export type Pace = { part: number; title: string | null; words: number; thin: boolean };
/** Pacing (design section 6, rulings S2): each part's written words over its bound nodes, the thin parts first. */
export function pacing(s: Story): Pace[] {
  const o = outlineOf(s);
  if (!o) return [];
  const parts = o.parts.map((title, part) => {
    const nodes = new Set(o.beats.filter((b) => b.part === part).flatMap((b) => b.nodes));
    return { part, title, words: [...nodes].reduce((a, r) => a + (s.words[r] ?? 0), 0) };
  });
  const by = parts.map((p) => p.words).sort((a, b) => a - b);
  const median = by[Math.floor(by.length / 2)] ?? 0;
  // ponytail: "thin" is below half the median part (the design says "far below"); retune on the owner's outline
  const paced = parts.map((p) => ({ ...p, thin: p.words < median / 2 }));
  return [...paced.filter((p) => p.thin), ...paced.filter((p) => !p.thin)];
}
