// The Flow graph's planted models (kernel/ts/test/author_flow*.test.ts): q and d1 in beat 1, d2 and d3
// in beat 2, r1, thera_greets and the fact f unplaced; V adds the edges the line and card cases need.
import type { Flow } from '../../../tools/author-panel/src/flow.ts';
import type { Edge, Story } from '../../../tools/author-panel/src/storylist.ts';

export const ref = (kind: string, key: string) => `demo@1:${kind}/${key}`;
export const [q, d1, d2, d3, r1, thera, f] = [
  ref('quest', 'q'),
  ref('dialogue', 'd1'),
  ref('dialogue', 'd2'),
  ref('dialogue', 'd3'),
  ref('reaction', 'r1'),
  ref('reaction', 'thera_greets'),
  ref('fact', 'f'),
];
export const model = (refs: string[], edges: Edge[], outline: Story['outline'] = null): Story => ({
  hash: 'h',
  graph: { nodes: refs.map((r) => ({ ref: r, kind: r.split(':')[1]!.split('/')[0]! })), edges },
  report: {
    unreachable: {},
    behind_lock: { rooms: [] },
    orphan_facts: { unused: [], write_only: [], read_only: [f] },
  },
  outline,
  todo: {},
  diagnostics: {},
  map: [],
  words: {},
  choices: {},
  hidden: [],
  unlinkable: {},
  files: {},
  bundled: {},
  shorts: [],
});
// Beat 1 holds q and d1, beat 2 d2 and d3; d1 `then` d2, forks to d3 by `check` and reads f, as r1
// does; d2 and d3 `then` back to d1 (two loops). f is a read_only fact; thera_greets is unrelated.
export const edges: Edge[] = [
  { from: d1, to: d2, path: '.choices.a.then', op: 'then' }, // story.ts links() shape
  { from: d1, to: d3, path: '/check/fail' },
  { from: d1, to: f, path: '/when', op: 'fact_compare' },
  { from: d2, to: d1, path: '/then' },
  { from: d3, to: d1, path: '/then' },
  { from: r1, to: f, path: '/when', op: 'fact_compare' },
];
export const outline = {
  parts: ['Arrival'],
  beats: [
    { part: 0, n: 1, title: 'Gate', status: 'built', nodes: [q, d1] },
    { part: 0, n: 2, title: 'Mill', status: 'built', nodes: [d2, d3] },
  ],
  unpaid: [],
  unseeded: [],
} satisfies Story['outline'];
export const planted = model([q, d1, d2, d3, r1, thera, f], edges, outline);
export const OPEN = { fold: [] };
export const line = (fl: Flow, a: string, b: string) =>
  fl.lines.find((l) => l.from === a && l.to === b)!;
export const col = (fl: Flow, id: string) =>
  [...fl.chips, ...fl.stubs].find((c) => c.id === id)!.col;

// V: planted plus a second d1 `then` d2 (one line, two edges), d2 `then` d3 (same column), a self
// `then` on d1, r1 `then` thera (one stub when Unplaced is shut), and d1 and thera reading an NPC.
export const npc = ref('npc', 'aldous');
export const vEdges: Edge[] = [
  ...edges,
  { from: d1, to: d2, path: '.choices.b.then', op: 'then' },
  { from: d2, to: d3, path: '/then' },
  { from: d1, to: d1, path: '/then' },
  { from: r1, to: thera, path: '/then' },
  { from: d1, to: npc, path: '/when/npc' },
  { from: thera, to: npc, path: '/when/npc' },
];
export const V = model(
  planted.graph.nodes.map((n) => n.ref),
  vEdges,
  outline,
);
export const xy = (fl: Flow) => [...fl.chips, ...fl.stubs].map((c) => [c.id, c.x, c.y, c.col]);
