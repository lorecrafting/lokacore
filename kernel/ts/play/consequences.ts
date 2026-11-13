// A choice's consequences, two hops out (docs/design/story-tooling.md §2 C1): hop 1 is what taking it
// writes, hop 2 is every node whose `when` or event reads what hop 1 wrote. A pure walk over the
// Story model's edges (reach.ts's content graph plus story.ts's dialogue links), so it never
// evaluates a policy on a live world: a `fact_compare` leaf on a fact hop 1 wrote says holds or
// fails (§4.3), any other leaf is `depends`. A report for authors, not a check.
import { sentences } from './why_words.ts';

type Obj = Record<string, unknown>;
/** A content-graph link (reach.ts, and story.ts's dialogue links): `set` when it writes its fact,
 * `value` what that write writes, `leaf` the `fact_compare` object a read sits in, and `choice`
 * which choice a `choice_resolved` named. */
export type Edge = {
  from: string;
  to: string;
  path: string;
  op?: string;
  set?: true;
  cleared?: true;
  value?: unknown;
  leaf?: Obj;
  choice?: string;
};
/** The part of the Story model the walk reads (story.ts serves it as `GET /story`). */
export type Model = {
  graph: { nodes: { ref: string; kind: string }[]; edges: Edge[] };
  report: { orphan_facts: { unused: string[]; write_only: string[]; read_only: string[] } };
};

const CAP = 20; // how many readers the panel lists; `more` says how many it left out
const key = (ref: string) => ref.slice(ref.lastIndexOf('/') + 1);
/** `<node>#<choice>` names one choice of a dialogue, a bare ref the node's own steps (a scene's
 * `on_end`, a reaction's steps, a story point's outcome). */
const split = (ref: string) => {
  const at = ref.indexOf('#');
  return at < 0
    ? { node: ref, choice: undefined }
    : { node: ref.slice(0, at), choice: ref.slice(at + 1) };
};
/** The choice a step path sits in, as reach.ts spells it (`.choices.yes.steps[0]…`). */
const inChoice = (path: string) => /^\.choices\.([a-z0-9_]+)\./.exec(path)?.[1];
/** Hop 1: what taking it writes — a fact, a quest its steps start or end, or the dialogue a `then`
 * enters. */
const wrote = (e: Edge) =>
  e.set === true ||
  /^(then|then_failed|quest\.(activate|resolve|fail))$/.test(e.op ?? '') ||
  e.path.startsWith('.on_end');
const label = (e: Edge) =>
  e.op === 'then_failed'
    ? 'then (failed)'
    : e.op === 'then'
      ? 'then'
      : e.set
        ? 'sets'
        : (e.op ?? 'reaches');
// story.ts's dialogue links are not reads of a fact or quest
const LINK = new Set(['then', 'then_failed', 'choice_resolved']);

export type Effect = { ref: string; key: string; label: string; what?: unknown };
export type Gate = { text: string; ok: boolean | 'depends' };
export type Reader = { ref: string; key: string; via: string; gates: Gate[] };
export type Consequences = {
  hop1: Effect[];
  hop2: Reader[];
  more: number; // readers past the cap
  neverRead: string[]; // facts hop 1 writes that nothing reads (reachReport's write_only)
};

/** Hop 1: the edges `ref` itself writes: its own steps, or one choice's of a dialogue. */
const written = (edges: Edge[], node: string, choice: string | undefined) =>
  edges
    .filter((e) => e.from === node)
    .filter((e) => (choice === undefined ? !inChoice(e.path) : inChoice(e.path) === choice))
    .filter(wrote);

/**
 * `ref`'s consequences in `model`. Hop 2 lists a reader once per fact or quest it reads, so a
 * reader of two of them is two rows, each with its own gates.
 */
export function consequences(model: Model, ref: string): Consequences {
  const { node, choice } = split(ref);
  const edges = model.graph.edges;
  const hop1 = written(edges, node, choice);
  const readers = hops(edges, hop1, node, choice);
  return {
    hop1: hop1.map((e) => ({
      ref: e.to,
      key: key(e.to),
      label: label(e),
      ...(e.value !== undefined && { what: e.value }),
    })),
    hop2: readers.slice(0, CAP),
    more: Math.max(0, readers.length - CAP),
    neverRead: hop1
      .filter((e) => e.set && model.report.orphan_facts.write_only.includes(e.to))
      .map((e) => key(e.to)),
  };
}

/** Hop 2's rows: whatever reads what hop 1 wrote (no write of its own, not one of story.ts's links,
 * and never the same choice reading its own write), then the reactions that named this choice. A
 * dialogue a `then` enters is hop 1's own row, so it is not listed twice. */
function hops(edges: Edge[], hop1: Edge[], node: string, choice: string | undefined): Reader[] {
  const readers: Reader[] = [];
  const seen = new Set<string>();
  const gates = gatesOf(edges, new Map(hop1.filter((e) => e.set).map((e) => [e.to, e.value])));
  const push = (ref: string, at: string | undefined, via: string) => {
    const id = `${ref}|${at ?? ''}|${via}`;
    if (seen.has(id)) return;
    seen.add(id);
    readers.push({
      ref,
      key: at === undefined ? key(ref) : `${key(ref)}#${at}`,
      via,
      gates: gates(ref, at),
    });
  };
  for (const w of hop1.filter((e) => e.set || e.op?.startsWith('quest.')))
    for (const e of edges)
      if (
        e.to === w.to &&
        !e.set &&
        !LINK.has(e.op ?? '') &&
        !hop1.includes(e) &&
        !(e.from === node && choice !== undefined && inChoice(e.path) === choice)
      )
        push(e.from, inChoice(e.path), key(w.to));
  // story.ts links a reaction from the dialogue whose choice it named: the row is the reaction
  for (const e of edges.filter((x) => x.from === node))
    if (e.op === 'choice_resolved' && (choice === undefined || e.choice === choice))
      push(e.to, undefined, e.op);
  return readers;
}

/** A reader's gates: the `when` leaves of `at` (one choice's of a dialogue), each settled where hop 1
 * wrote the fact it compares and a hint anywhere else (§4.3: the view never evaluates a live world).
 * `wrote` maps a fact to the value hop 1 writes. */
function gatesOf(edges: Edge[], wrote: Map<string, unknown>) {
  return (at: string, choice: string | undefined) =>
    edges
      .filter((e) => e.from === at && e.leaf && inChoice(e.path) === choice)
      // the same gate read twice is one row
      .filter(
        (e, i, all) =>
          all.findIndex((x) => JSON.stringify(x.leaf) === JSON.stringify(e.leaf)) === i,
      )
      .map((e): Gate => {
        const leaf = e.leaf!;
        // hop 1 has written it by the time the reader runs, so the gate is settled: `holds` is the
        // leaf as authored being satisfied, `not` folded in (why_words says the `not` in the words)
        const holds = !wrote.has(e.to)
          ? 'depends'
          : (wrote.get(e.to) === leaf['equals']) !== (leaf['not'] === true);
        const [row] = sentences({ policy: { ...leaf, holds } });
        return { text: row!.text, ok: row!.ok };
      });
}
