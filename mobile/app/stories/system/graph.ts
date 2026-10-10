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
  spec: string[];
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
  files: { file: string; title: string; layer: string }[];
  capabilities: Capability[];
  nodes: Contract[];
  edges: { from: string; to: string; kind: string; field: string | null }[];
  saveTables: { table: string; rows: string }[];
};

export const graph: Graph = JSON.parse(raw);
export const contracts = new Map(graph.nodes.map((n) => [n.name, n]));
export const capabilities = new Map(graph.capabilities.map((c) => [c.id, c]));

// A repository file on GitHub: relative links open nothing inside Storybook (Catalogue.mdx).
export const repo = (path: string, line?: number) =>
  `https://github.com/lorecrafting/lokacore/blob/main/${path}${line ? `#L${line}` : ''}`;

// A System docs page in the Storybook manager (the top window), with URL globals.
export const page = (id: string, globals: Record<string, string> = {}) => {
  const top = window.top?.location ?? window.location;
  const g = Object.entries(globals).map(([k, v]) => `${k}:${v}`);
  return `${top.origin}${top.pathname}?path=/docs/system-${id}--docs${g.length ? `&globals=${g.join(';')}` : ''}`;
};
