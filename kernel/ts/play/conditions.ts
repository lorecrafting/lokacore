// Named conditions in the Story map (docs/design/story-tooling.md §2b K1 row 2): the compile
// substitutes every `{"op": "named", "key": k}` leaf away (Loka.Content.Conditions), so the compiled
// artifact never carries a condition. Its node and its reader edges are read from the source instead,
// over the `Edge` shape reach.ts's graph uses (from: the definition naming it, to: the condition), so
// "who reads this" is a condition node's inbound edges, like any other node's.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isObj, step } from '../src/content/cartridge_refs.ts';
import { placed } from './guard.ts';
import { files } from './todo.ts';

export type Edge = { from: string; to: string; path: string; op: string };
export type Nodes = { ref: string; kind: string }[];

const CONDITION = /^conditions\/([a-z0-9_]+)\.json$/;
/** A condition's node ref, in a definition's own shape, so places() and shell.ts find it. */
const ref = (cartridge: string, key: string) => `${cartridge}:condition/${key}`;

/** A source file's parsed value, or undefined when the file is not JSON (the compiler's diagnostic). */
function held(source: string, rel: string): unknown {
  try {
    return JSON.parse(readFileSync(join(source, rel), 'utf8'));
  } catch {
    return undefined;
  }
}

/** Every `{"op": "named", "key": k}` leaf under `v`, with the path it sits at. */
function leaves(v: unknown, path = '', into: { path: string; key: string }[] = []) {
  if (Array.isArray(v)) v.forEach((x, i) => leaves(x, `${path}[${i}]`, into));
  else if (isObj(v)) {
    if (v.op === 'named' && typeof v.key === 'string') into.push({ path, key: v.key });
    for (const [k, x] of Object.entries(v)) leaves(x, `${path}${step(k)}`, into);
  }
  return into;
}

/**
 * The condition nodes and their reader edges: one node per `conditions/<key>.json`, and an edge from
 * every definition that names it (a condition naming another is itself a reader, so a chain shows).
 * `refs` maps a short `<dir>/<key>` to its node ref, as story.ts's shortRefs builds it; `cartridge` is
 * the artifact's cartridge_id, which a ref starts with.
 */
export function conditionGraph(source: string, cartridge: string, refs: Map<string, string>) {
  const all = files(source).map(
    (rel) => [rel, CONDITION.exec(rel)?.[1] as string | undefined] as const,
  );
  const nodes: Nodes = all.flatMap(([, key]) =>
    key === undefined ? [] : [{ ref: ref(cartridge, key), kind: 'condition' }],
  );
  const edges: Edge[] = [];
  for (const [rel, key] of all) {
    // the file's owner: a condition itself, or the definition whose source file it is (an area
    // bundle's member has no file of its own, so no node to draw from)
    const at = placed(rel);
    const from =
      key === undefined
        ? refs.get(at ? `${at.ext === 'scene' ? 'dialogues' : at.dir}/${at.key}` : '')
        : ref(cartridge, key);
    if (from === undefined) continue;
    const value = held(source, rel);
    for (const leaf of value === undefined ? [] : leaves(value))
      edges.push({ from, to: ref(cartridge, leaf.key), path: leaf.path, op: 'named' });
  }
  return { nodes, edges };
}
