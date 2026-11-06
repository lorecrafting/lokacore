// What the Flow graph reads off its layout (rulings S3): focus and follow ink, search, the footer,
// the hover card, the keys and the palette rows. No React; tested from kernel/ts/test/author_flow.test.ts.
import { reads } from '../../../kernel/ts/play/reads.ts';
import { cmp, F, key, laneOf, plural, solid, type Chip, type Flow, type Part, type Stub } from './flow.ts';
import { nearest, type MapRoom } from './map.ts';
import { fromRef, type Item, type Layout } from './shell.ts';
import { go, isOpen, LIST, outlineOf, toggle, type Edge, type Story } from './storylist.ts';

/** The refs inked by a focus: the node and `hops` steps of edges either way, between lane refs
 * only (a room, NPC or item is not a node; walking through one would ink unrelated nodes). */
export function focusInk(s: Story, ref: string, hops: number) {
  const ink = new Set([ref]);
  const lanes = s.graph.edges.filter((x) => laneOf(x.from) && laneOf(x.to));
  for (let i = 0; i < hops; i++)
    for (const e of lanes.filter((x) => ink.has(x.from) || ink.has(x.to)))
      ink.add(e.from).add(e.to);
  return ink;
}

/** A followed fact with its setters and its readers (Trace's rule). */
export function followed(s: Story, fact: string) {
  const into = s.graph.edges.filter((e) => e.to === fact && laneOf(e.from));
  const setters = into.filter((e) => e.set).map((e) => e.from);
  const readers = into.filter((e) => reads(!!e.set, fromRef(e.from)?.kind)).map((e) => e.from);
  return new Set([fact, ...setters, ...readers]);
}

/** Search: nodes whose key or kind, a fact they touch, or an edge path (event names) holds the text. */
export function search(s: Story, text: string) {
  const t = text.trim().toLowerCase();
  if (!t) return undefined;
  const hit = (v: string) => v.toLowerCase().includes(t);
  const ink = new Set<string>();
  for (const n of s.graph.nodes) if (laneOf(n.ref) && (hit(key(n.ref)) || hit(n.kind))) ink.add(n.ref);
  for (const e of s.graph.edges)
    if (laneOf(e.from) && ((fromRef(e.to)?.kind === 'fact' && hit(key(e.to))) || hit(e.path)))
      ink.add(e.from);
  return ink;
}

/** A drawn id is inked when it, or a ref it stands for, is (no ink: everything is). */
export const inked = (f: Flow, ink: Set<string> | undefined, id: string) =>
  !ink || ink.has(id) || [...ink].some((r) => f.at.get(r) === id);

/** The footer (rulings S3): `following <key>` first while following. */
export const footer = (f: Flow, follow?: string) =>
  [
    follow && `following ${key(follow)}`,
    plural(f.nodes, 'node'),
    plural(f.edges, 'edge'),
    plural(f.loops.size, 'loop'),
    `${f.hidden} hidden`,
  ]
    .filter(Boolean)
    .join(' · ');

const verb = (e: Edge) =>
  fromRef(e.to)?.kind === 'fact'
    ? `${e.set ? 'sets' : 'reads'} ${key(e.to)}`
    : `${e.op ?? e.path.split(/[./]/).filter(Boolean).pop()} → ${key(e.to)}`;

/** The hover card's edge rows (`sets k`, `reads k`, `<op> → k`, `← k`), at most F.rows, then a
 * count of the rest; `depends` names the conditions and the non-lane anchors it reads. */
export function card(s: Story, ref: string) {
  const out = s.graph.edges.filter((e) => e.from === ref);
  const rows = [
    ...out.filter((e) => laneOf(e.to)).map(verb),
    ...s.graph.edges.filter((e) => e.to === ref && laneOf(e.from)).map((e) => `← ${key(e.from)}`),
  ].filter((r, i, a) => a.indexOf(r) === i);
  const conditions = out.filter((e) => !solid(e) && e.op).map((e) => e.op!);
  const anchors = out.filter((e) => !laneOf(e.to) && fromRef(e.to)).map((e) => key(e.to));
  return {
    rows: rows.slice(0, F.rows),
    more: Math.max(0, rows.length - F.rows),
    depends: [...new Set([...conditions, ...anchors])],
  };
}

const first = (list: Edge[], end: 'from' | 'to') =>
  list.map((e) => e[end]).filter((r) => laneOf(r)).sort(cmp)[0];

// The drawn ids as rooms on a grid (column, row over all lanes) for the map's arrow-key rule.
function grid(f: Flow) {
  const drawn = [...f.chips, ...f.stubs];
  const top = new Map<string, number>();
  let row = 0; // mutate-skip: origin; the arrow rule reads only relative positions
  for (const l of f.lanes) top.set(l.lane, row), (row += (l.h - F.pad) / F.pitch);
  const room = (c: Chip | Stub) => {
    const lane = f.lanes.find((l) => l.lane === c.lane)!;
    return { key: c.id, at: { x: c.col, y: top.get(c.lane)! + (c.y - lane.y) / F.pitch } } as MapRoom;
  };
  return { drawn, room };
}

/** The keyboard's next drawn id from `id` (rulings S3 Keyboard), or undefined. */
export function step(s: Story, f: Flow, id: string, k: string, shift = false): string | undefined {
  const { drawn, room } = grid(f);
  const from = drawn.find((c) => c.id === id);
  if (!from) return undefined;
  const top = (col: number) => drawn.filter((c) => c.col === col).sort((a, b) => a.y - b.y)[0]?.id;
  const ofPart = (p?: Part) => p && top(f.columns.findIndex((c) => c.part === p.id));
  const partAt = f.parts.findIndex((p) => p.id === f.columns[from.col].part);
  if (k.startsWith('Arrow')) return nearest(drawn.map(room), room(from), k)?.key;
  const cols = drawn.map((c) => c.col);
  if (k === 'Home') return top(Math.min(...cols));
  if (k === 'End') return top(Math.max(...cols));
  if (k === 'PageUp') return ofPart(f.parts[partAt - 1]);
  if (k === 'PageDown') return ofPart(f.parts[partAt + 1]);
  const out = k === 'Enter' && shift && first(s.graph.edges.filter((e) => e.from === id), 'to');
  const back = k === 'Backspace' && first(s.graph.edges.filter((e) => e.to === id), 'from');
  const next = out || back;
  return next ? f.at.get(next) : undefined;
}

/** Tab's way in: the selected node's drawn id, else the first chip by column then row. */
export const entry = (f: Flow, selected?: string) =>
  (selected && f.at.get(selected)) || [...f.chips].sort((a, b) => a.col - b.col || a.y - b.y)[0]?.id;

/** The palette's Flow rows: collapse and expand all, follow each fact, unfollow. */
export function flowItems(s: Story): Item[] {
  const row = (label: string, id: string) => ({ kind: 'story' as const, label, detail: 'flow', id });
  return [
    row('flow: collapse all', 'flow:collapse'),
    row('flow: expand all', 'flow:expand'),
    ...s.graph.nodes.filter((n) => n.kind === 'fact').map((n) => row(`follow ${key(n.ref)}`, `follow:${n.ref}`)),
    row('unfollow', 'unfollow'),
  ];
}

/** A Flow palette row applied to the layout (Flow shown), or undefined for any other id. While
 * Flow is shown a story row selects its node and a beat row opens its part, in Flow (rulings S3:
 * Flow never changes the layout on its own). */
export function flowGo(s: Story, l: Layout, id: string): Layout | undefined {
  const o = outlineOf(s);
  const ids = [...(o?.parts ?? []).map((_, i) => `part:${i}`), 'unplaced'];
  const all = (open: boolean) =>
    ids.reduce((st, p) => (isOpen(st, p, !!o) === open ? st : toggle(st, p)), l.story ?? LIST);
  const flow = { ...l, leftOpen: true, map: 'flow' as const };
  if (id === 'flow:collapse') return { ...flow, story: all(false) };
  if (id === 'flow:expand') return { ...flow, story: all(true) };
  if (id.startsWith('follow:')) return { ...flow, flow: { ...l.flow, follow: id.slice(7) } };
  if (id === 'unfollow') return { ...flow, flow: { ...l.flow, follow: undefined } };
  if (l.map !== 'flow') return undefined;
  const ref = id.slice(6);
  if (id.startsWith('story:')) return { ...flow, selection: { file: s.files[ref], ...fromRef(ref)! } };
  return id.startsWith('beat:') ? { ...flow, story: go(s, l.story ?? LIST, id) } : undefined;
}
