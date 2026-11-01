// The author panel's find (docs/system/cartridge.md#author-preview): a key or words to each source
// file:line, and each definition whose refs name that key. The refs come from the compiled artifact,
// where the compiler has already expanded every short ref (lib/loka/content/leaf_refs.ex, resolve.ex).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { files } from './todo.ts';

const CAP = 100; // a one-letter search answers at once; `total` says how many there were
type Ref = { key: string; kind: string; cartridge_id: string };
export type Referrer = { kind: string; by: string; at?: string };

const isRef = (v: object): v is Ref => 'cartridge_id' in v && 'key' in v && 'kind' in v;
// The kinds under which `v` names `q`.
function named(v: unknown, q: string, kinds = new Set<string>()) {
  if (Array.isArray(v)) v.forEach((x) => named(x, q, kinds));
  else if (v && typeof v === 'object') {
    if (isRef(v)) {
      if (v.key === q) kinds.add(v.kind);
    } else Object.values(v).forEach((x) => named(x, q, kinds));
  }
  return kinds;
}

const lineOf = (path: string, q: string) => {
  const i = readFileSync(path, 'utf8')
    .split('\n')
    .findIndex((l) => l.includes(q));
  return i < 0 ? 1 : i + 1;
};

/** The definitions that refer to `q`, by section and short name, located in the source when a file is named for them. */
function referrers(source: string, artifact: string, q: string, rels: string[]): Referrer[] {
  if (!existsSync(artifact)) return [];
  const { canonical } = JSON.parse(readFileSync(artifact, 'utf8')) as { canonical: string };
  const { text, manifest, lock, ...cartridge } = JSON.parse(canonical) as Record<string, unknown>;
  const found: Referrer[] = [];
  for (const [section, value] of Object.entries(cartridge)) {
    const keyed = value && typeof value === 'object' && !Array.isArray(value);
    const defs = keyed && !isRef(value) ? Object.entries(value) : [];
    const whole = defs.length === 0 || !defs.every(([k]) => k.includes('@'));
    for (const [name, def] of whole ? [[section, value] as const] : defs)
      for (const kind of named(def, q)) {
        const short = name.slice(name.lastIndexOf('/') + 1);
        const by = whole ? section : `${section}/${short}`;
        const file = rels.find((r) => r.startsWith(`${by}.`));
        found.push({ kind, by, ...(file && { at: `${file}:${lineOf(join(source, file), q)}` }) });
      }
  }
  return found;
}

/** Every source line holding `q` (case-insensitive) and every definition referring to the key `q`. */
export function find(source: string, artifact: string, q: string) {
  const rels = files(source);
  const hits: { at: string; text: string }[] = [];
  let total = 0;
  const lower = q.toLowerCase();
  for (const rel of q ? rels : [])
    readFileSync(join(source, rel), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (!line.toLowerCase().includes(lower)) return;
        if (++total <= CAP) hits.push({ at: `${rel}:${i + 1}`, text: line.trim() });
      });
  return { hits, total, refs: q ? referrers(source, artifact, q, rels) : [] };
}
