// The Story list and Trace (docs/design/editor-map-and-story-rulings.md S2): the tree's visible
// rows, the arrow keys' moves, which rows a selection or a palette row opens, a trace's rows and
// the palette's story rows. No React here: tested from kernel/ts/test/author_story.test.ts.
// size: allow 338, R2's coverage rows (`covered`, `uncovered`, the uncovered filter) sit beside the
// rows they colour; the trace panel and palette rows come out together when this next needs room
import { reads } from '../../../kernel/ts/play/reads.ts';
import type { Edge } from '../../../kernel/ts/play/consequences.ts';
import type { FactUsage } from '../../../kernel/ts/play/fact_usage.ts';
import type { Triggers } from '../../../kernel/ts/play/scene_trigger.ts';
import type { MapRoom } from './map.ts';
import type { Covered } from '../../../kernel/ts/play/covered_type.ts';
import { fromRef, type Item } from './shell.ts';

export type { Edge };
export type { FactUsage };
export type Todo = { file: string; words: number; placeholders: string[] };
export type Beat = {
  part: number;
  n: number;
  title?: string;
  status: string; // built, ~, missing or unreached
  missing?: string[];
  nodes: string[];
};
export type Outline = {
  parts: (string | null)[];
  beats: Beat[];
  unpaid: { seed: string; n: number }[];
  unseeded: { pays: string; n: number }[];
};
export type Story = {
  hash: string;
  graph: { nodes: { ref: string; kind: string }[]; edges: Edge[] };
  report: {
    unreachable: Record<string, string[]>;
    behind_lock: { rooms: string[] };
    orphan_facts: { unused: string[]; write_only: string[]; read_only: string[] };
  };
  outline: Outline | { refused: string } | null;
  facts: FactUsage[]; // F1's table (storyfacts.ts)
  todo: Record<string, Todo[]>;
  diagnostics: Record<string, { code?: string; path?: string }[]>;
  files: Record<string, string>;
  bundled: Record<string, string>; // a bundle member's ref => its areas/<a>.json
  map: MapRoom[];
  words: Record<string, number>; // written words by node (Pacing)
  names: Record<string, string>; // written name by node, none for `~` (shell.ts `named`)
  choices: Record<string, number>; // choice count by dialogue (Knowledge)
  hidden: string[]; // hidden skills' keys
  unlinkable: Record<string, string>; // dialogue key => the keyword, quest or riddle no then enters
  shorts: string[]; // the short refs a beat may bind (story.ts resolve)
  triggers: Triggers; // what a modal scene may start on (scene_trigger.ts)
};

/** The kinds the list holds (design section 4.1); Trace opens on the fact, quest and story point. */
export const KINDS = ['quest', 'story_point', 'scene', 'dialogue', 'reaction', 'action', 'fact', 'topic', 'npc'];
export const TRACED = new Set(['fact', 'quest', 'story_point']);
/** The kinds Consequences opens on (C1): the nodes whose steps and choices write something. */
export const CONSEQUENCES = new Set(['dialogue', 'scene', 'reaction', 'story_point']);
const DASHED = new Set(['time_since']); // a read the clock settles, a hint (design 4.3)

export type Row = {
  id: string;
  level: number; // aria-level
  parent?: string;
  kind: 'part' | 'beat' | 'node' | 'seed';
  label: string;
  name: string; // the accessible name
  title?: string;
  open?: boolean; // absent on a leaf
  ref?: string;
  node?: string; // a node row's kind
  n?: number;
  status?: string;
  refusals?: number;
  todo?: number;
  unreached?: boolean;
  covered?: string[]; // R2: the checkpoint names that reach it; absent when none do
  uncovered?: boolean; // R2: nothing reaches it (the `uncovered` filter and the chip's colour)
};
/** The lower section's one panel (rulings S2; C1 adds Consequences, F1 adds Facts): Trace of a ref,
 * Consequences of a choice or node, Knowledge at a beat, Pacing, or the Facts table. */
export type Lower =
  | { panel: 'trace'; at: string }
  | { panel: 'consequences'; at: string }
  | { panel: 'knowledge'; n: number }
  | { panel: 'facts' }
  | { panel: 'pacing' };
/** The list's kept state (Layout.story): the ids toggled from their default, the lower panel, the row to focus. */
// chosen: the palette picked the focus, so the selection's reveal on mount yields to it once
// only: R2's `uncovered` filter (docs/design/story-tooling.md `### R2`)
export type ListState = { fold: string[]; lower?: Lower; focus?: string; chosen?: true; only?: 'uncovered' };
export const LIST: ListState = { fold: [] };

export const outlineOf = (s: Story) => (s.outline && 'beats' in s.outline ? s.outline : undefined);
// Parts and Seeds start open, beats shut, Unplaced open only when it is the whole list.
const opens = (id: string, outlined: boolean) =>
  id === 'unplaced' ? !outlined : !id.startsWith('beat:');
export const isOpen = (st: ListState, id: string, outlined: boolean) =>
  opens(id, outlined) !== st.fold.includes(id);
export const toggle = (st: ListState, id: string): ListState => ({
  ...st,
  fold: st.fold.includes(id) ? st.fold.filter((f) => f !== id) : [...st.fold, id],
});

/** The swatch a beat's status draws (chrome rulings section 4's chip rule, at 16 px). */
export const SWATCH: Record<string, string> = {
  built: 'bg-card border border-input',
  '~': 'bg-warning-soft border border-warning',
  missing: 'hatch border border-dashed border-muted-foreground',
  unreached: 'border border-dashed border-muted-foreground',
};

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

function nodeRow(s: Story, ref: string, parent: string, level: number, off: Set<string>, at: Covered = {}, known = Object.keys(at).length > 0): Row {
  const sel = fromRef(ref);
  const key = sel?.key ?? ref;
  const diags = s.diagnostics[ref] ?? [];
  const todo = (s.todo[ref] ?? []).reduce((n, t) => n + t.placeholders.length, 0);
  const unreached = off.has(ref);
  const covered = at[ref];
  const name = [
    `${key}, ${sel?.kind}`,
    diags.length && plural(diags.length, 'refusal'),
    todo && `${todo} ~`,
    unreached && 'unreached',
    covered?.length && `covered by ${covered.join(', ')}`,
  ].filter(Boolean);
  const words = diags.map((d) => [d.code, d.path].filter(Boolean).join(' ')).join('\n');
  const reached = covered?.length ? `covered: ${covered.join(', ')}` : '';
  return {
    id: `${parent}/${ref}`,
    level,
    parent,
    kind: 'node',
    label: key,
    name: name.join(', '),
    ...((words || reached) && { title: [words, reached].filter(Boolean).join('\n') }),
    ref,
    node: sel?.kind,
    refusals: diags.length,
    todo,
    unreached,
    ...(covered?.length ? { covered } : known && { uncovered: true }),
  };
}

type Ctx = { s: Story; st: ListState; outlined: boolean; off: Set<string>; at: Covered };
// A row with children: its `open` flag, then its children when open.
const branch = (c: Ctx, row: Row, kids: () => Row[]): Row[] => {
  const open = isOpen(c.st, row.id, c.outlined);
  return [{ ...row, open }, ...(open ? kids() : [])];
};

function beatRows(c: Ctx, b: Outline['beats'][number]): Row[] {
  const id = `beat:${b.n}`;
  // the status word, with what is missing: a built beat says nothing
  const word = b.status === 'built' ? '' : [b.status, ...(b.missing ?? [])].join(' ');
  const row: Row = {
    id,
    level: 2,
    parent: `part:${b.part}`,
    kind: 'beat',
    label: b.title ?? '',
    name: [`beat ${b.n}`, b.title, word].filter(Boolean).join(', '),
    ...(b.missing?.length && { title: word }),
    n: b.n,
    status: b.status,
  };
  const kids = () => b.nodes.map((r) => nodeRow(c.s, r, id, 3, c.off, c.at));
  return b.nodes.length ? branch(c, row, kids) : [row];
}

function seedRows(c: Ctx, o?: Outline): Row[] {
  const warn = (label: string, n: number, id: string): Row => {
    const text = `${label} · beat ${n}`;
    return { id, level: 2, parent: 'seeds', kind: 'seed', label: text, name: text };
  };
  const loose = [
    ...(o?.unpaid ?? []).map((u) => warn(`seed ${u.seed} · no payoff`, u.n, `seeds/${u.seed}`)),
    ...(o?.unseeded ?? []).map((u) => warn(`payoff ${u.pays} · no seed`, u.n, `pays/${u.pays}`)),
  ];
  const row: Row = { id: 'seeds', level: 1, kind: 'part', label: 'Seeds', name: 'Seeds' };
  return loose.length ? branch(c, row, () => loose) : [];
}

/** The visible rows, in order: the outline's parts with their beats and bound nodes, Seeds, then
 * Unplaced. `at` is R2's coverage (kernel/ts/play/covered.ts), empty until the watcher pushes one;
 * with `st.only` set, only what nothing reaches is shown (the `uncovered` filter). */
export function rows(s: Story, st: ListState, at: Covered = {}): Row[] {
  const o = outlineOf(s);
  const c: Ctx = { s, st, outlined: !!o, off: new Set(Object.values(s.report.unreachable).flat()), at };
  // before the watcher's first answer nothing is known about any node, so the filter shows all
  if (st.only === 'uncovered' && Object.keys(at).length) return uncoveredRows(c, o);
  const parts = (o?.parts ?? []).flatMap((title, i) => {
    const label = [`Part ${i + 1}`, title].filter(Boolean).join('  ');
    const row: Row = { id: `part:${i}`, level: 1, kind: 'part', label, name: label };
    return branch(c, row, () => o!.beats.filter((b) => b.part === i).flatMap((b) => beatRows(c, b)));
  });
  const bound = new Set(o?.beats.flatMap((b) => b.nodes));
  const unplaced = s.graph.nodes.filter((n) => KINDS.includes(n.kind) && !bound.has(n.ref));
  const label = `Unplaced (${unplaced.length})`;
  const tail = branch(c, { id: 'unplaced', level: 1, kind: 'part', label, name: label }, () =>
    unplaced.map((n) => nodeRow(s, n.ref, 'unplaced', 2, c.off, c.at)),
  );
  return [...parts, ...seedRows(c, o), ...tail];
}

/** R2's `uncovered` filter: the beats and nodes nothing reaches. A beat stays when any node it binds
 * is uncovered, and its parts arrive open so the rows are visible rather than folded away. Before the
 * watcher has pushed any coverage the whole list stays: nothing is known, so nothing is hidden. */
function uncoveredRows(c: Ctx, o: Outline | undefined): Row[] {
  const loose = (ref: string) => !c.at[ref]?.length;
  const beats = (o?.beats ?? []).filter((b) => b.nodes.some(loose));
  const parts = (o?.parts ?? []).flatMap((title, i) => {
    const mine = beats.filter((b) => b.part === i);
    if (!mine.length) return [];
    const label = [`Part ${i + 1}`, title].filter(Boolean).join('  ');
    const head: Row = { id: `part:${i}`, level: 1, kind: 'part', label, name: label, open: true };
    return [head, ...mine.flatMap((b) => beatRows(c, b))];
  });
  const rest = c.s.graph.nodes.filter((n) => KINDS.includes(n.kind) && loose(n.ref));
  const label = `Unplaced (${rest.length})`;
  const tail: Row[] = rest.length
    ? [
        { id: 'unplaced', level: 1, kind: 'part', label, name: label, open: true },
        ...rest.map((n) => nodeRow(c.s, n.ref, 'unplaced', 2, c.off, c.at)),
      ]
    : [];
  return [...parts, ...tail];
}

/** The `dim` line over the list: why there are no beats, if there are none. */
export const note = (s: Story) =>
  !s.outline ? 'No outline.json; every node is unplaced.' : 'refused' in s.outline ? s.outline.refused : undefined;

/** An arrow key on the focused row (WAI-ARIA tree): the row to focus, or the row to open or shut. */
export function move(list: Row[], id: string, key: string): { focus?: string; toggle?: string } {
  const i = list.findIndex((r) => r.id === id);
  const r = list[i];
  if (!r) return {};
  if (key === 'ArrowDown') return { focus: list[i + 1]?.id };
  if (key === 'ArrowUp') return { focus: list[i - 1]?.id };
  if (key === 'ArrowRight') return r.open === false ? { toggle: id } : r.open ? { focus: list[i + 1]?.id } : {};
  if (key === 'ArrowLeft') return r.open ? { toggle: id } : { focus: r.parent };
  return {};
}

// Open each of `path` that is shut and focus `id`.
const opened = (st: ListState, path: string[], id: string, outlined: boolean) =>
  path.reduce<ListState>((acc, p) => (isOpen(acc, p, outlined) ? acc : toggle(acc, p)), { ...st, focus: id });

/** A selection from elsewhere: open the node's first beat (or Unplaced) and focus its row; a kind the list does not hold changes nothing. */
export function reveal(s: Story, st: ListState, ref: string): ListState {
  const o = outlineOf(s);
  // the row clicked keeps its beat, not the node's first one
  const b =
    o?.beats.find((x) => st.focus === `beat:${x.n}/${ref}` && x.nodes.includes(ref)) ??
    o?.beats.find((x) => x.nodes.includes(ref));
  if (b) return opened(st, [`part:${b.part}`, `beat:${b.n}`], `beat:${b.n}/${ref}`, true);
  const kind = s.graph.nodes.find((n) => n.ref === ref)?.kind;
  return kind && KINDS.includes(kind) ? opened(st, ['unplaced'], `unplaced/${ref}`, !!o) : st;
}

/** A palette story row (`facts:`, `beat:<n>`, `story:<ref>`, `trace:<ref>`, `consequences:<ref>`): open the
 * table, or open and focus its row and its third or fourth panel. */
export function go(s: Story, st: ListState, id: string): ListState {
  const [what, ...rest] = id.split(':');
  const target = rest.join(':');
  if (what === 'facts') return { ...st, lower: { panel: 'facts' } };
  if (what === 'beat') {
    const b = outlineOf(s)?.beats.find((x) => String(x.n) === target);
    return b ? opened(st, [`part:${b.part}`], `beat:${b.n}`, true) : st;
  }
  const next = reveal(s, st, target);
  if (what === 'trace') return { ...next, lower: { panel: 'trace', at: target } };
  if (what === 'consequences') return { ...next, lower: { panel: 'consequences', at: target } };
  return next;
}

export type TraceRow = { label: string; ref?: string; key?: string; beat?: number; dashed?: boolean };
/** Trace (design 5d, lean): a fact's writers and readers with their beat and what nothing does; another kind's inbound links by op. */
export function trace(s: Story, ref: string): TraceRow[] {
  const beats = outlineOf(s)?.beats ?? [];
  const row = (label: string, e: Edge): TraceRow => ({
    label,
    ref: e.from,
    key: fromRef(e.from)?.key ?? e.from,
    beat: beats.find((b) => b.nodes.includes(e.from))?.n,
    ...(DASHED.has(e.op ?? '') && { dashed: true }),
  });
  // one row per node and role: a dialogue that sets the fact in two choices is one writer
  const into = s.graph.edges.filter(
    (e, i, all) => e.to === ref && all.findIndex((x) => x.to === ref && x.from === e.from && x.op === e.op && x.set === e.set) === i,
  );
  if (fromRef(ref)?.kind !== 'fact') return into.map((e) => row(e.op ?? 'used at', e));
  const o = s.report.orphan_facts;
  const never = (
    [
      [o.read_only, 'never set'],
      [o.write_only, 'never read'],
      [o.unused, 'unused'],
    ] as const
  ).flatMap(([facts, label]) => (facts.includes(ref) ? [{ label }] : []));
  const read = (e: Edge) => reads(!!e.set, fromRef(e.from)?.kind);
  return [
    ...never,
    ...into.filter((e) => e.set).map((e) => row('set at', e)),
    ...into.filter(read).map((e) => row('read at', e)),
  ];
}

/** The palette's story rows (rulings S2 Cmd-K): `beat <n> <title>`, F1's `facts`, `story: <key>`,
 * `trace <key>`. */
export function storyItems(s: Story): Item[] {
  const beats: Item[] = [
    ...(outlineOf(s)?.beats ?? []).map((b) => ({
      kind: 'story' as const,
      label: [`beat ${b.n}`, b.title].filter(Boolean).join(' '),
      detail: 'beat',
      id: `beat:${b.n}`,
    })),
    { kind: 'story' as const, label: 'facts', detail: 'facts', id: 'facts:' },
  ];
  const nodes = s.graph.nodes
    .filter((n) => KINDS.includes(n.kind))
    .flatMap((n) => {
      const key = fromRef(n.ref)?.key ?? n.ref;
      const row = (label: string, id: string) => ({ kind: 'story' as const, label, detail: n.kind, id });
      return [
        row(`story: ${key}`, `story:${n.ref}`),
        ...(TRACED.has(n.kind) ? [row(`trace ${key}`, `trace:${n.ref}`)] : []),
        ...(CONSEQUENCES.has(n.kind) ? [row(`consequences ${key}`, `consequences:${n.ref}`)] : []),
      ];
    });
  return [...beats, ...nodes];
}
