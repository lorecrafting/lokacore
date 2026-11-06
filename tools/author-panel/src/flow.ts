// The Flow graph's layout (docs/design/editor-map-and-story-rulings.md S3): the story lanes on a
// grid of beats (or dependency layers) and the drawn edges. No React and no layout library;
// tested from kernel/ts/test/author_flow.test.ts. Ink, keys and the palette are in flowread.ts.
import { fromRef, type Layout } from './shell.ts';
import { isOpen, LIST, outlineOf, type Edge, type Story } from './storylist.ts';

/** Drawing constants in px at zoom 1, exempt from the space tokens as the map's `M` is. */
export const F = {
  col: 160, // mutate-skip: drawing constant
  w: 144, // mutate-skip: drawing constant
  h: 28, // mutate-skip: drawing constant
  pitch: 32, // mutate-skip: drawing constant
  pad: 12, // mutate-skip: drawing constant (space.lg, under a lane's tallest cell)
  top: 32, // mutate-skip: drawing constant (room above the top lane for the loops' back arcs)
  cap: 12,
  chars: 20, // mutate-skip: drawing constant
  dim: 0.3,
  hoverDelay: 300,
  overview: 0.5, // mutate-skip: drawing constant (chips are discs below this zoom)
  rows: 6, // the hover card's edge rows before `+N more`
  gutter: 56, // mutate-skip: drawing constant (the opening pan: room for the lane labels)
};

/** Design 5a's five lanes in order; the lane decides a chip's corners (pill, rounded, square). */
export const LANES = [
  { lane: 'story', kinds: ['story_point', 'chapter'], shape: 'rounded-full' },
  { lane: 'quest', kinds: ['quest'], shape: 'rounded-full' },
  { lane: 'dialogue', kinds: ['dialogue', 'scene'], shape: 'rounded-md' },
  { lane: 'reaction', kinds: ['reaction', 'action'], shape: 'rounded-md' },
  { lane: 'fact', kinds: ['fact', 'topic'], shape: 'rounded-none' },
];
const LANE = new Map(LANES.flatMap((l) => l.kinds.map((k) => [k, l])));
export const laneOf = (ref: string) => LANE.get(fromRef(ref)?.kind ?? '');

// story.ts `links()` ops: the dialogue chain, which the compiler checks
const CHAIN = new Set(['then', 'then_failed', 'choice_resolved']);
/** Solid: an edge the compiler could refuse. Dashed (design 4.3): a `check` fork, a condition's
 * read (an op without a dot: fact_compare, quest_state, time_since) or a fact read. */
export const solid = (e: Edge) =>
  !e.path.split(/[./]/).includes('check') &&
  !(e.op && !e.op.includes('.') && !CHAIN.has(e.op)) &&
  (fromRef(e.to)?.kind !== 'fact' || !!e.set);

export type FlowState = { fold: string[]; filters?: string[]; open?: string[]; reveal?: string };
/** The kept Flow state (Layout.flow) with the list's folds (Layout.story): one fold set for both. */
export const stateOf = (l: Layout, more: { open?: string[]; reveal?: string } = {}): FlowState => ({
  fold: (l.story ?? LIST).fold,
  filters: l.flow?.filters,
  ...more,
});

export const key = (ref: string) => fromRef(ref)?.key ?? ref;
export const cmp = (a: string, b: string) => Number(a > b) - Number(a < b);
export const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** The filter popover's toggles: a lane id hides its lane; the other two keep only their nodes. */
export const FILTERS = [...LANES.map((l) => l.lane), 'needs words', 'potential problems'];
const todoOf = (s: Story, ref: string) =>
  (s.todo[ref] ?? []).reduce((n, t) => n + t.placeholders.length, 0);
const problem = (s: Story, off: Set<string>, ref: string) => {
  const o = s.report.orphan_facts;
  const orphan = [o.unused, o.write_only, o.read_only].some((f) => f.includes(ref));
  return !!s.diagnostics[ref]?.length || off.has(ref) || orphan;
};

type At = { x: number; y: number; col: number };
export type Chip = At & { id: string; key: string; kind: string; lane: string; shape: string; name: string };
export type Stub = At & { id: string; kind: 'more' | 'count'; lane: string; icon: string; n: number };
export type Column = { id: string; part: string; x: number; n?: number; title?: string; status?: string };
export type Part = { id: string; label: string; open: boolean; x: number; w: number };
export type Lane = { lane: string; y: number; h: number };
export type Line = { id: string; from: string; to: string; solid: boolean; loop: boolean; d: string; edges: Edge[] };
export type Flow = ReturnType<typeof layout>;
type Cell = { id: string; col: number; lane: string; refs: string[]; rows: number; keep: number };

/** Longest-path layers over `edges`; a cycle breaks at its DFS back edge (refs in key order). */
export function layers(refs: string[], edges: Edge[]) {
  const inside = new Set(refs);
  const out = new Map<string, string[]>();
  for (const e of edges)
    if (inside.has(e.to))
      out.set(e.from, [...(out.get(e.from) ?? []), e.to].sort(cmp));
  const seen = new Set<string>();
  const post: string[] = [];
  const visit = (r: string) => {
    seen.add(r);
    for (const t of out.get(r) ?? []) if (!seen.has(t)) visit(t);
    post.push(r);
  };
  for (const r of [...refs].sort(cmp)) if (!seen.has(r)) visit(r);
  const order = post.reverse();
  const at = new Map(order.map((r, i) => [r, i]));
  const layer = new Map(refs.map((r) => [r, 0]));
  for (const r of order)
    for (const t of out.get(r) ?? [])
      if (at.get(t)! > at.get(r)!) layer.set(t, Math.max(layer.get(t)!, layer.get(r)! + 1));
  return layer;
}

// The nodes the filters keep, among the lane kinds.
function shownOf(s: Story, st: FlowState, all: string[]) {
  const off = new Set(Object.values(s.report.unreachable).flat());
  const f = new Set(st.filters ?? []);
  return all.filter(
    (r) =>
      !f.has(laneOf(r)!.lane) &&
      (!f.has('needs words') || todoOf(s, r) > 0) &&
      (!f.has('potential problems') || problem(s, off, r)),
  );
}

// Columns: an open part's beats, a collapsed part as one; Unplaced's layers when open.
function columnsOf(s: Story, st: FlowState, shown: string[], edges: Edge[]) {
  const o = outlineOf(s);
  const beatOf = new Map<string, number>();
  for (const b of o?.beats ?? []) for (const r of b.nodes) if (!beatOf.has(r)) beatOf.set(r, b.n);
  const columns: Column[] = [];
  const parts: Part[] = [];
  const colOf = new Map<string, number>();
  const part = (id: string, label: string, members: string[], cols: Omit<Column, 'x' | 'part'>[], within: (r: string) => number) => {
    const open = isOpen({ ...LIST, fold: st.fold }, id, !!o);
    const first = columns.length;
    const list = open ? cols : [{ id }];
    list.forEach((c, i) => columns.push({ ...c, part: id, x: (first + i) * F.col }));
    parts.push({ id, label, open, x: first * F.col, w: list.length * F.col });
    for (const r of members) colOf.set(r, first + (open ? within(r) : 0));
  };
  (o?.parts ?? []).forEach((title, i) => {
    const beats = o!.beats.filter((b) => b.part === i);
    const cols = beats.map((b) => ({ id: `beat:${b.n}`, n: b.n, title: b.title, status: b.status }));
    const index = (r: string) => beats.findIndex((b) => b.n === beatOf.get(r));
    const label = [`Part ${i + 1}`, title].filter(Boolean).join('  ');
    if (beats.length) part(`part:${i}`, label, shown.filter((r) => index(r) >= 0), cols, index);
  });
  const loose = shown.filter((r) => !beatOf.has(r));
  const layer = layers(loose, edges.filter(solid));
  const depth = Math.max(0, ...layer.values());
  const cols = Array.from({ length: depth + 1 }, (_, i) => ({ id: `layer:${i}` }));
  if (loose.length) part('unplaced', `Unplaced (${loose.length})`, loose, cols, (r) => layer.get(r)!);
  return { columns, parts, colOf, beatOf };
}

// Cells per column and lane, keys in order; a long open cell keeps F.cap chips and a `+N`.
function cellsOf(st: FlowState, columns: Column[], parts: Part[], colOf: Map<string, number>) {
  const shut = new Set(parts.filter((p) => !p.open).map((p) => p.id));
  const cells = new Map<string, Cell>();
  const order = [...colOf.keys()].sort((a, b) => cmp(key(a), key(b)) || cmp(a, b));
  for (const r of order) {
    const [col, lane] = [colOf.get(r)!, laneOf(r)!.lane];
    const id = `${columns[col].id}|${lane}`;
    const cell = cells.get(id) ?? { id, col, lane, refs: [], rows: 0, keep: 0 };
    cell.refs.push(r);
    cells.set(id, cell);
  }
  for (const c of cells.values()) {
    const all = (st.open ?? []).includes(c.id) || (!!st.reveal && c.refs.includes(st.reveal));
    const capped = c.refs.length > F.cap && !all;
    c.keep = shut.has(columns[c.col].part) ? 0 : capped ? F.cap : c.refs.length;
    c.rows = c.keep ? c.keep + Number(capped) : 1;
  }
  return [...cells.values()];
}

// Lanes in design order, each as tall as its tallest cell; only lanes with something drawn.
function lanesOf(cells: Cell[]) {
  const lanes: Lane[] = [];
  let y = F.top;
  for (const { lane } of LANES) {
    const mine = cells.filter((c) => c.lane === lane);
    if (!mine.length) continue;
    const h = Math.max(...mine.map((c) => c.rows)) * F.pitch + F.pad;
    lanes.push({ lane, y, h });
    y += h;
  }
  return { lanes, h: y };
}

// Chips and stubs; `at` maps each shown ref to the id it draws as.
function drawn(s: Story, cells: Cell[], columns: Column[], lanes: Lane[], beatOf: Map<string, number>, edges: Edge[]) {
  const off = new Set(Object.values(s.report.unreachable).flat());
  const chips: Chip[] = [];
  const stubs: Stub[] = [];
  const at = new Map<string, string>();
  for (const c of cells) {
    const place = (i: number) => ({ x: columns[c.col].x + (F.col - F.w) / 2, y: lanes.find((l) => l.lane === c.lane)!.y + i * F.pitch, col: c.col });
    c.refs.slice(0, c.keep).forEach((r, i) => {
      const sel = fromRef(r)!;
      const name = [
        `${sel.key}, ${sel.kind}`,
        beatOf.has(r) && `beat ${beatOf.get(r)}`,
        s.diagnostics[r]?.length && plural(s.diagnostics[r].length, 'refusal'),
        todoOf(s, r) && `${todoOf(s, r)} ~`,
        off.has(r) && 'unreached',
        `${edges.filter((e) => e.from === r).length} outbound`,
        `${edges.filter((e) => e.to === r).length} inbound`,
      ];
      chips.push({ id: r, key: sel.key, kind: sel.kind, lane: c.lane, shape: laneOf(r)!.shape, name: name.filter(Boolean).join(', '), ...place(i) });
      at.set(r, r);
    });
    if (c.keep === c.refs.length) continue;
    const id = c.keep ? `more:${c.id}` : `count:${columns[c.col].part}|${c.lane}`;
    const icon = c.keep ? fromRef(c.refs[c.keep])!.kind : laneOf(c.refs[0])!.kinds[0];
    stubs.push({ id, kind: c.keep ? 'more' : 'count', lane: c.lane, icon, n: c.refs.length - c.keep, ...place(c.keep) });
    for (const r of c.refs.slice(c.keep)) at.set(r, id);
  }
  return { chips, stubs, at };
}

// The path of a line from p to q: a bezier forward, an arc on the right within a column, and a
// loop's back arc above the top lane.
function path(p: At, q: At) {
  const [x1, y1, x2, y2] = [p.x + F.w, p.y + F.h / 2, q.x, q.y + F.h / 2];
  if (p.col > q.col) return `M${x1},${y1} C${x1 + F.pad},${F.top / 4} ${x2 - F.pad},${F.top / 4} ${x2},${y2}`;
  if (p.col === q.col) return `M${x1},${y1} C${x1 + F.pad},${y1} ${x1 + F.pad},${y2} ${q.x + F.w},${y2}`;
  const mid = (x1 + x2) / 2;
  return `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`;
}

// One line per drawn pair and class, holding its model edges.
function linesOf(edges: Edge[], at: Map<string, string>, pos: Map<string, At>) {
  const lines = new Map<string, Line>();
  for (const e of edges) {
    const [a, b] = [at.get(e.from), at.get(e.to)];
    if (!a || !b || a === b) continue;
    const id = `${a}>${b}>${solid(e) ? 's' : 'd'}`;
    const line = lines.get(id);
    if (line) line.edges.push(e);
    else {
      const [p, q] = [pos.get(a)!, pos.get(b)!];
      lines.set(id, { id, from: a, to: b, solid: solid(e), loop: p.col > q.col, d: path(p, q), edges: [e] });
    }
  }
  return [...lines.values()];
}

/** The whole graph placed: a pure function of the model and the state. */
export function layout(s: Story, st: FlowState) {
  const all = s.graph.nodes.filter((n) => laneOf(n.ref)).map((n) => n.ref);
  const edges = s.graph.edges.filter((e) => laneOf(e.from) && laneOf(e.to));
  const shown = shownOf(s, st, all);
  const { columns, parts, colOf, beatOf } = columnsOf(s, st, shown, edges);
  const cells = cellsOf(st, columns, parts, colOf);
  const { lanes, h } = lanesOf(cells);
  const { chips, stubs, at } = drawn(s, cells, columns, lanes, beatOf, edges);
  const lines = linesOf(edges, at, new Map([...chips, ...stubs].map((c) => [c.id, c])));
  return {
    columns,
    parts: outlineOf(s) ? parts : [], // no outline: no part row (rulings S3 Grid)
    lanes,
    chips,
    stubs,
    lines,
    at,
    loops: new Set(lines.filter((l) => l.loop).map((l) => l.id)),
    nodes: shown.length,
    edges: lines.reduce((n, l) => n + l.edges.length, 0),
    hidden: all.length - shown.length,
    note: outlineOf(s) ? undefined : 'No outline.json; columns are dependency layers.',
    w: columns.length * F.col,
    h,
  };
}
