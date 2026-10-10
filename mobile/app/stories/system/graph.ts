// docs/system-graph.gen.json (bin/system_graph.exs) for the System pages. Read as text and parsed
// once, so tsc infers no type over 400 kB of JSON.
import raw from '../../../../docs/system-graph.gen.json?raw';

export type Field = { name: string; type: string; required: boolean; enum: unknown[] | null };
export type Contract = {
  name: string;
  file: string;
  line: number;
  layer: string;
  kind: string;
  owner: string | null;
  description: string | null;
  fields: Field[];
  enum: unknown[] | null;
  examples: unknown[] | null;
  spec: { cite: string; path: string }[]; // path#heading of the archived spec
  saved: string[] | null; // the state_row sections a DeltaOp writes it into
  authored: string[] | null; // cartridges/*/<map>/*.json of the CompiledCartridge map holding it
};
export type Capability = {
  id: string;
  portability: string;
  residency: string;
  commands: string[];
  definitions: { kind: string; node: string | null }[];
  events: string[];
  policies: string[];
};
export type Graph = {
  layers: string[];
  files: { file: string; title: string; layer: string; fixtures: string[] }[];
  capabilities: Capability[];
  nodes: Contract[];
  edges: { from: string; to: string; kind: string; field: string | null }[];
  // state_row carries the State sections and the MutationTarget kinds kept in each.
  saveTables: {
    table: string;
    rows: string;
    sections?: { section: string; targets: string[] }[];
  }[];
};

export const graph: Graph = JSON.parse(raw);
export const contracts = new Map(graph.nodes.map((n) => [n.name, n]));
export const capabilities = new Map(graph.capabilities.map((c) => [c.id, c]));

// The shortest chain of references from one contract to another (breadth first), or null.
export function path(from: string, to: string) {
  const prev = new Map([[from, '']]);
  for (const at of prev.keys()) {
    if (at === to) break;
    for (const e of graph.edges) if (e.from === at && !prev.has(e.to)) prev.set(e.to, at);
  }
  if (!prev.has(to)) return null;
  const chain = [to];
  while (chain[0] !== from) chain.unshift(prev.get(chain[0])!);
  return chain;
}

// A repository file on GitHub: relative links open nothing inside Storybook (Catalogue.mdx).
export const repo = (path: string, line?: number) =>
  `https://github.com/lorecrafting/lokacore/blob/main/${path}${line ? `#L${line}` : ''}`;

// A System docs page in the Storybook manager (the top window), with URL globals.
export const page = (id: string, globals: Record<string, string> = {}) => {
  let top = window.location; // a cross-origin manager (a composed ref) keeps its location to itself
  try {
    top = window.top?.location.origin ? window.top.location : top;
  } catch {}
  const g = Object.entries(globals).map(([k, v]) => `${k}:${v}`);
  return `${top.origin}${top.pathname}?path=/docs/system-${id}--docs${g.length ? `&globals=${g.join(';')}` : ''}`;
};
