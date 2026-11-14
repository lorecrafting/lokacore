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

/** A condition, at the root or inside an area's bundle (`source.ex:255` places both). */
const CONDITION = /^(?:areas\/[a-z0-9_]+\/)?conditions\/([a-z0-9_]+)\.json$/;
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

/** The condition file's own leaves, or a bundle member's section of the bundle, into `push`. */
function walk(
  source: string,
  cartridge: string,
  refs: Map<string, string>,
  members: Map<string, string>,
  push: (from: string | undefined, value: unknown) => void,
) {
  // a key at the root AND inside an area folder would otherwise give one condition two nodes
  const seen = new Set<string>();
  for (const rel of files(source)) {
    const key = CONDITION.exec(rel)?.[1];
    if (key !== undefined) {
      if (seen.has(key)) continue;
      seen.add(key);
      push(ref(cartridge, key), held(source, rel));
      continue;
    }
    // a definition in a file of its own (a bundle member has none, so `members` holds it instead)
    const at = placed(rel);
    const own = at && `${at.ext === 'scene' ? 'dialogues' : at.dir}/${at.key}`;
    if (own && !members.has(own)) push(refs.get(own), held(source, rel));
  }
  // a bundle member: its own section of the bundle, so its leaves are its own and not the bundle's
  for (const [bundledKey, bundleFile] of members) {
    const value = held(source, bundleFile) as Record<string, Record<string, unknown>> | undefined;
    if (!isObj(value)) continue;
    const [section, member] = bundledKey.split('/');
    if (isObj(value[section!])) push(refs.get(bundledKey), value[section!]![member!]);
  }
}

/**
 * The condition nodes and their reader edges: one node per condition file, and an edge from every
 * definition that names it (a condition naming another is itself a reader, so a chain shows).
 * `refs` maps a short `<dir>/<key>` to its node ref, as story.ts's shortRefs builds it, and also
 * each bundle member's `${section}/${key}`; `bundles` maps that key to the file holding the member.
 * `cartridge` is the artifact's ref prefix.
 */
export function conditionGraph(
  source: string,
  cartridge: string,
  refs: Map<string, string>,
  bundles: Record<string, string>,
) {
  const members = new Map(Object.entries(bundles));
  const nodes: Nodes = files(source).flatMap((rel) => {
    const key = CONDITION.exec(rel)?.[1];
    return key === undefined ? [] : [{ ref: ref(cartridge, key), kind: 'condition' }];
  });
  const edges: Edge[] = [];
  walk(source, cartridge, refs, members, (from, value) => {
    if (from === undefined) return;
    for (const leaf of leaves(value))
      edges.push({ from, to: ref(cartridge, leaf.key), path: leaf.path, op: 'named' });
  });
  // the same key found twice is one node, not two at one ref
  return { nodes: nodes.filter((n, i) => nodes.findIndex((m) => m.ref === n.ref) === i), edges };
}
