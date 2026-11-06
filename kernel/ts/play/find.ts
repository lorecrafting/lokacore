// The author panel's find (docs/system/cartridge.md#author-preview): a key or words to each source
// file:line, and each definition whose refs name that key. The refs come from the compiled artifact,
// where the compiler has already expanded every short ref (lib/loka/content/leaf_refs.ex, resolve.ex).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { current, placed, refuse, sha256 } from './guard.ts';
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
      if (v.key.toLowerCase() === q) kinds.add(v.kind);
    } else Object.values(v).forEach((x) => named(x, q, kinds));
  }
  return kinds;
}

// 0 when the file never spells the key (say, a copy from `extends`): nothing invented.
const lineOf = (path: string, q: string) =>
  readFileSync(path, 'utf8')
    .split('\n')
    .findIndex((l) => l.toLowerCase().includes(q)) + 1;

/** The definitions that refer to `q`, by section and short name, located in the source when a file is named for them. */
function referrers(source: string, artifact: string, query: string, rels: string[]): Referrer[] {
  const q = query.toLowerCase(); // `named` and `lineOf` take it lowered
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
        // Scripted actions are authored under actions/.
        const stem = by.replace(/^scripted_actions\//, 'actions/');
        const file = rels.find((r) => r.startsWith(`${stem}.`));
        const line = file ? lineOf(join(source, file), q) : 0;
        found.push({ kind, by, ...(line > 0 && { at: `${file}:${line}` }) });
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
  return { hits, total, refs: referrers(source, artifact, q, rels) };
}

/** What a delete of `section/key` would leave dangling, so the compile would refuse it: the other
 * definitions whose refs name it as its own kind, and the source files that extend it.
 * ponytail: reads the last good compile, so a definition added under Hold or since a refused compile
 * is not seen; recompile first when that bites. */
export function users(source: string, artifact: string, section: string, key: string): Referrer[] {
  const rels = files(source);
  const extending = rels
    .filter((rel) => placed(rel)?.dir === section && placed(rel)?.ext === 'json')
    .filter((rel) => {
      try {
        return JSON.parse(readFileSync(join(source, rel), 'utf8'))?.extends === key;
      } catch {
        return false; // a file that is not JSON is the compile's to report
      }
    })
    .map((rel) => ({ kind: 'extends', by: rel.replace(/\.json$/, ''), at: `${rel}:1` }));
  if (!existsSync(artifact)) return extending;
  const c = JSON.parse(JSON.parse(readFileSync(artifact, 'utf8')).canonical);
  const defs = { ...c[section], ...(section === 'actions' && c.scripted_actions) }; // scripted actions are authored under actions/
  const own = Object.keys(defs).find((k) => k.endsWith(`/${key}`)); // `<cartridge>@<version>:<kind>/<key>`
  const kind = own?.slice(own.indexOf(':') + 1, own.lastIndexOf('/'));
  // its own refs, and the layout row the delete drops with a room, leave nothing dangling
  const refs = referrers(source, artifact, key, rels).filter(
    (r) =>
      r.kind === kind &&
      r.by.replace(/^scripted_actions\//, 'actions/') !== `${section}/${key}` &&
      r.by !== 'layout',
  );
  return [...refs, ...extending];
}

const read = (source: string, rel: string) => {
  try {
    return JSON.parse(readFileSync(join(source, rel), 'utf8'));
  } catch {
    return null; // a missing file, or one that is not JSON, is the compile's to report
  }
};
export type Member = { rel: string; dir: string; key: string };
// a ref's `by` names its artifact section; a scripted action's source dir is actions/
const own = (by: string) => by.replace(/^scripted_actions\//, 'actions/');
/** What a delete of `file` (`at`: its kind and key) takes with it in one entry, so it leaves nothing
 * dangling, and what outside that set still names a member: a transport's return leg that names it
 * back (each leg's `reverse` names the other), and each template only the set names (death.ex:121-131
 * refuses a template item no population or death names), a template only another taken one names
 * included. The deleted file is the set's first. */
export function taken(
  source: string,
  artifact: string,
  file: string,
  at: { dir: string; key: string },
) {
  const set: Member[] = [{ rel: file, ...at }];
  const add = (rel: string) => set.push({ rel, dir: placed(rel)!.dir, key: placed(rel)!.key });
  const has = (by: string) => set.some((m) => `${m.dir}/${m.key}` === own(by));
  const back = at.dir === 'transports' && read(source, file)?.reverse;
  const leg = back && join(dirname(file), `${back}.json`);
  if (leg && leg !== file && read(source, leg)?.reverse === at.key) add(leg);
  const templates = files(source).filter((rel) => {
    const p = placed(rel);
    if (p?.ext !== 'json' || (p.dir !== 'npcs' && p.dir !== 'items')) return false;
    const doc = read(source, rel);
    return doc?.spawn_template === true || doc?.location?.in === 'template';
  });
  for (let grew = true; grew;) {
    grew = false; // a template named only by one taken later in the same pass waits for the next
    for (const rel of templates) {
      if (set.some((m) => m.rel === rel)) continue;
      const by = users(source, artifact, placed(rel)!.dir, placed(rel)!.key).map((r) => r.by);
      if (by.length && by.every(has)) grew = add(rel) > 0;
    }
  }
  const left = set.flatMap((m) => users(source, artifact, m.dir, m.key)).filter((r) => !has(r.by));
  return { set, left };
}
export const still = (set: Member[], left: Referrer[]) =>
  `${set[1] ? 'are' : 'is'} still named by ${left.map((r) => r.at ?? r.by).join(', ')}: change those first`;
/** The other files a delete takes, each checked like the first (refused 409 with their shas unless
 * `also` sent each one's current sha), and the layout.json row of a deleted room. */
export function others(source: string, file: string, set: Member[], also?: Record<string, string>) {
  const rest = set.slice(1).map((m) => ({ file: m.rel, before: current(join(source, m.rel)) }));
  if (rest.some((o) => also?.[o.file] !== sha256(o.before)))
    refuse(409, { set: rest.map((o) => ({ file: o.file, sha256: sha256(o.before) })) });
  const gone = rest.map((o) => ({ ...o, after: null as string | null }));
  const room = placed(file)?.dir === 'rooms' ? placed(file)!.key : undefined;
  const layout = current(join(source, 'layout.json')); // another file's room matches no row
  try {
    const rows = JSON.parse(layout ?? 'null');
    const kept = Array.isArray(rows) ? rows.filter((r) => r?.room !== room) : rows;
    if (kept?.length < rows?.length) {
      const after = kept.length ? `${JSON.stringify(kept, null, 2)}\n` : null;
      return [...gone, { file: 'layout.json', before: layout, after }];
    }
  } catch {
    // a layout.json that is not JSON is the compile's to report
  }
  return gone;
}
