// Consequences (docs/design/story-tooling.md §2 C1): what taking a choice writes, two hops out. The walk
// is kernel/ts/play/consequences.ts; this maps it to panel rows. No React here: tested from
// kernel/ts/test/author_story.test.ts.
import { consequences } from '../../../kernel/ts/play/consequences.ts';
import type { Story } from './storylist.ts';

export type ConsequenceRow = {
  label: string; // `choice`, `sets`, `read via asked`, `needs`, `never read`, `and N more`
  ref?: string; // the node a click selects
  key?: string; // the node's key, with the value a write stores
  ok?: boolean | 'depends'; // a `needs` row's verdict: settled met, settled unmet, or only a hint
  at?: string; // a `choice` row's own `<node>#<choice>`: a click walks it
  depth: number; // 0 heads a group, 1 sits under it
};

const CHOICE = /^\.choices(?:\.([^.[]+)|\["([^"]+)"\])/;
/** A dialogue's choice keys, as the graph's edge paths name them. */
export const choicesOf = (s: Story, ref: string): string[] => [
  ...new Set(
    s.graph.edges
      .filter((e) => e.from === ref)
      .map((e) => CHOICE.exec(e.path)?.slice(1).join(''))
      .filter((k): k is string => !!k),
  ),
];

const shown = (k: string, what?: unknown) => (what === undefined ? k : `${k} = ${JSON.stringify(what)}`);

/** What `<node>#<choice>` (or a bare node) writes, then who reads it with each reader's gates. */
function walk(s: Story, at: string): ConsequenceRow[] {
  const c = consequences(s, at);
  const nodes = new Set(s.graph.nodes.map((n) => n.ref));
  return [
    ...c.hop1.map((e) => ({ label: e.label, ref: e.ref, key: shown(e.key, e.what), depth: 0 })),
    ...c.hop2.flatMap((r) => [
      { label: `read via ${r.via}`, key: r.key, ...(nodes.has(r.ref) && { ref: r.ref }), depth: 0 },
      ...r.gates.map((g) => ({ label: g.text, ok: g.ok, depth: 1 })),
    ]),
    ...c.neverRead.map((f) => ({ label: 'never read', key: f, depth: 0 })),
    ...(c.more ? [{ label: `and ${c.more} more readers`, depth: 0 }] : []),
  ];
}

/**
 * The panel's rows for `at`: a dialogue lists each of its choices with what picking it writes, each
 * `choice` row a click walks, then the node's own steps (a scene's `on_end`, a reaction's steps, a
 * story point's outcome). A choice walked (`<node>#<choice>`) is its two hops: what it writes, every
 * reader with its gates, and the writes nothing reads.
 */
export function consequenceRows(s: Story, at: string): ConsequenceRow[] {
  if (at.includes('#')) return walk(s, at);
  const choices = choicesOf(s, at);
  return [
    ...choices.flatMap((choice) => [
      { label: 'choice', key: choice, at: `${at}#${choice}`, depth: 0 },
      ...consequences(s, `${at}#${choice}`).hop1.map((e) => ({
        label: e.label,
        ref: e.ref,
        key: shown(e.key, e.what),
        depth: 1,
      })),
    ]),
    ...walk(s, at),
  ];
}
