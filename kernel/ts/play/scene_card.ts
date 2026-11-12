// POST /set (docs/system/cartridge.md, Editor write path): a `.scene` file's one `npc:`, `with:`
// or `then:` value in place, a real key; POST /edit stays words only (prose.ts).
import { existsSync, readFileSync } from 'node:fs';
import { INSTALLED, loadCartridge } from '../src/index.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';
import { artifactBytes } from './compiled.ts';
import { guarded, named, placed, refuse, sha256, stale } from './guard.ts';
import { contentGraph } from './reach.ts';
import { picks, VALUE, type Verb } from './scene_lines.ts';
import { cut, scene } from './scene_structure.ts';
import { unlinkable } from './story_counts.ts';
import { bundled, files } from './todo.ts';
import { crossed } from './world_card.ts';
import type { Answer, Change } from './write.ts';

/** The last good compile's cartridge, loaded as the panel's story model loads it (story.ts). */
export function compiledCartridge(artifact: string | undefined) {
  if (!artifact || !existsSync(artifact)) return undefined;
  const loaded = loadCartridge(
    artifactBytes(JSON.parse(readFileSync(artifact, 'utf8'))),
    INSTALLED,
  );
  return loaded.ok ? (loaded.cartridge as unknown as Obj) : undefined;
}

/** The keys a value line may name: the last good compile's (`c`, the loaded artifact), as the card
 * picks them; before a compile, only `end`. */
export function ids(c: Obj = {}): Record<Verb, string[]> {
  const { nodes } = contentGraph(c);
  return {
    npc: picks('npc', nodes),
    with: picks('with', nodes),
    then: picks('then', nodes, unlinkable(c)),
  };
}

/** The source file of the `dir` definition `key`, else its bundle (story.ts nodeOf: a `.scene` is a dialogue). */
const home = (root: string, key: string, dir: string) =>
  files(root).find((f) => {
    const p = placed(f);
    return p?.key === key && (p.ext === 'scene' ? 'dialogues' : p.dir) === dir;
  }) ?? bundled(root)[`${dir}/${key}`];

export function set(
  root: string,
  { file, line, was, value }: Record<string, any>,
  keys: () => Record<Verb, string[]>,
  done: (what: string, change: Change) => Answer,
) {
  const path = guarded(root, file, 'read');
  if (placed(file)?.ext !== 'scene') refuse(400, 'a value line is a .scene file’s');
  if (typeof was !== 'string' || !named(value)) refuse(400, 'was: the line; value: [a-z0-9_]+');
  const before = readFileSync(path, 'utf8');
  const lines = before.split('\n');
  if (!Number.isInteger(line) || line < 1 || line > lines.length) refuse(400, 'no such line');
  if (lines[line - 1] !== was) stale(before);
  const [, head, verb, , end] = VALUE.exec(was) ?? refuse(400, 'not an npc:, with: or then: line');
  if (!keys()[verb as Verb].includes(value)) refuse(400, `${verb}: no such key ${value}`);
  const area = crossed(file, home(root, value, verb === 'then' ? 'dialogues' : 'npcs'));
  if (area) refuse(400, `${verb}: ${value} is area ${area}’s, not this file’s (area_rules.ex:27)`);
  lines[line - 1] = `${head}${value}${end}`;
  return done(`set ${file}:${line}`, { file, before, after: lines.join('\n') });
}

/** POST /restructure (docs/design/scene-structure-rulings.md §3): a `.cut` page op or a `.scene` line
 * op, recomputed from disk. A `carry` file (one the card showed) changed since its `was` is a 409
 * with its bytes. The compile's keys say whether a shifted `~` choice is in use (§2). */
export function restructure(
  root: string,
  { file, was, op, carry }: Record<string, any>,
  done: (what: string, changes: Change[]) => Answer,
  artifact?: string,
) {
  const path = guarded(root, file, 'read');
  const ext = placed(file)?.ext;
  if (ext !== 'cut' && ext !== 'scene') refuse(400, 'a page or line op is a .cut or .scene file’s');
  if (!Array.isArray(carry)) refuse(400, 'carry: an array of {file, was}');
  const before = readFileSync(path, 'utf8');
  if (sha256(before) !== was) stale(before);
  for (const c of carry) {
    const bytes = readFileSync(guarded(root, c?.file, 'read'), 'utf8');
    if (sha256(bytes) !== c.was) stale(bytes);
  }
  const twin = path.replace(/\.[a-z]+$/, '.json');
  let doc: Obj = {};
  try {
    doc = JSON.parse(readFileSync(twin, 'utf8'));
  } catch {} // no twin, or one the compiler refuses on its own
  const key = file.slice(file.lastIndexOf('/') + 1, -'.scene'.length);
  const answer =
    ext === 'cut' ? cut(before, op, 'steps' in doc) : scene(before, op, inUse(key, doc, artifact));
  if ('refused' in answer) return refuse(400, answer.refused);
  return done(`restructure ${file}`, [{ file, before, after: answer.after }]);
}

/** Whether a choice key of `file`'s dialogue `key` is named anywhere but the scene's own lines: the
 * twin's `choices.<c>`, a `riddle.choice_id`, a quest's `journal.outcomes.<c>`, a `choice_resolved`
 * reaction (coverage.ts:90-93), or a dialogue's `then` (§2's referrer table). The last good compile
 * is the index, and it holds every file, so this is one pass over it, not a scan per op. */
function inUse(key: string, doc: Obj, artifact?: string) {
  const own = new Set(Object.keys((doc.choices ?? {}) as Obj));
  void key;
  const c = compiledCartridge(artifact);
  const named = new Set<string>();
  if (!c) return (k: string) => own.has(k);
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v as Obj)) {
      if (k === 'choice_id' && typeof x === 'string') named.add(x);
      if (k === 'outcomes' && x && typeof x === 'object')
        Object.keys(x).forEach((o) => named.add(o));
      if (k === 'choice_resolved') named.add(String((x as Obj)?.choice_id ?? ''));
      walk(x);
    }
  };
  walk(c);
  return (k: string) => own.has(k) || named.has(k);
}
