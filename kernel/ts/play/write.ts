// size: allow 320, the write routes share one tree, guard and journal; /delete's reference gate and row delete join them
// The editor's write path (docs/system/cartridge.md#author-preview): `GET /source`, `/schema/<dir>`
// and `/journal`, and the POST routes that change the source tree. Every path a body names goes
// through `guarded` (guard.ts) once; every write is a `.tmp` and a rename, recorded in the journal
// `/undo` puts back from. live.ts checks Host and Origin first.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { files } from './todo.ts';
import { type Bytes, current, DIRS, guarded, named, placed, refuse, Refused } from './guard.ts';
import { ROOTS, SCHEMAS, rootFile, sha256, stale, there } from './guard.ts';
import { apply } from './edit_model.ts';
import { users } from './find.ts';
import { edit, located } from './prose.ts';
import { compiledCartridge, ids, set } from './scene_card.ts';
import { loka, opened, worlds } from './worlds.ts';

type By = 'editor' | 'outside';
export type Changed = { file: string; sha256: string | null; by: By };
export type Change = { file: string; before: Bytes; after: Bytes };
type Entry = { id: number; at: number; what: string; by: By; files: Change[] };
export type Answer = [status: number, body: unknown];
type Sent = Record<string, any>;
type Tree = ReturnType<typeof tree>;

const CAP = 64 * 1024 * 1024; // journal characters, every entry's before and after
export const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const diff = (a: Map<string, Bytes>, b: Map<string, Bytes>): Change[] =>
  [...new Set([...a.keys(), ...b.keys()])]
    .filter((f) => a.get(f) !== b.get(f))
    .map((file) => ({ file, before: a.get(file) ?? null, after: b.get(file) ?? null }));
const size = (e: Entry) =>
  e.files.reduce((n, f) => n + (f.before?.length ?? 0) + (f.after?.length ?? 0), 0);

function tree(source: string, push: (changed: Changed[]) => void) {
  const root = realpathSync(source); // macOS: /var is /private/var
  const snapshot = () => new Map(files(root).map((rel) => [rel, current(join(root, rel))]));
  // the bytes as last seen: a burst diffs against them, so an editor write is journaled once
  return {
    root,
    push,
    snapshot,
    cache: snapshot(),
    journal: [] as Entry[],
    ids: 0,
    total: 0,
    busy: 0,
  };
}

function record(t: Tree, what: string, by: By, changes: Change[]) {
  for (const c of changes) c.after === null ? t.cache.delete(c.file) : t.cache.set(c.file, c.after);
  const entry = { id: ++t.ids, at: Date.now(), what, by, files: changes };
  t.journal.unshift(entry);
  t.total += size(entry);
  while (t.total > CAP && t.journal.length > 1) t.total -= size(t.journal.pop()!);
  t.push(changes.map(({ file, after }) => ({ file, sha256: sha256(after), by })));
  return entry.id;
}
function put(root: string, rel: string, after: Bytes) {
  const path = join(root, rel);
  if (after === null) return rmSync(path);
  mkdirSync(dirname(path), { recursive: true });
  rmSync(`${path}.tmp`, { force: true }); // a planted link there is removed, never followed
  writeFileSync(`${path}.tmp`, after, { flag: 'wx' });
  renameSync(`${path}.tmp`, path);
}
function done(t: Tree, what: string, changes: Change[]): Answer {
  for (const c of changes) put(t.root, c.file, c.after);
  const id = record(t, what, 'editor', changes);
  return [200, { id, file: changes[0].file, sha256: sha256(changes[0].after) }];
}
/** The file's bytes, if the panel's `was` is still their sha256; else a 409 with them. */
function fresh(path: string, was: unknown) {
  const bytes = readFileSync(path, 'utf8');
  return sha256(bytes) === was ? bytes : stale(bytes);
}

function change(t: Tree, { file, was, ops }: Sent) {
  const path = guarded(t.root, file, 'read');
  if (!file.endsWith('.json')) refuse(400, 'a scene file changes by /edit, a line at a time');
  const before = fresh(path, was);
  let doc: unknown;
  try {
    doc = JSON.parse(before);
  } catch {
    refuse(400, `${file} is not JSON: fix it first`);
  }
  if (!Array.isArray(ops)) refuse(400, 'ops: an array');
  try {
    for (const op of ops) apply(doc, op);
  } catch (e) {
    refuse(400, (e as Error).message); // apply throws only its Refused, which names the reason
  }
  return done(t, `change ${file}`, [{ file, before, after: json(doc) }]);
}

const ROWS = ['facts', 'resources', 'attributes']; // root files of `{"<name>": {"<key>": definition}}`
/** Delete one definition: its file, or with `key` its row of a ROWS file; refused while another
 * definition still names it (the compile would refuse the dangling ref). */
function remove(t: Tree, { file, was, key }: Sent, artifact = '') {
  const path = guarded(t.root, file, 'read');
  const section = String(file).replace(/\.json$/, '');
  const row = key !== undefined && ROWS.includes(section);
  if (!row && (!file.includes('/') || rootFile(file)))
    refuse(400, `${file} is a root file: delete its rows, not the file`);
  if (row && !named(key)) refuse(400, 'key: [a-z0-9_]+');
  const at = row ? { dir: section, key } : placed(file);
  const left = at ? users(t.root, artifact, at.dir, at.key) : [];
  if (left.length)
    refuse(
      400,
      `${at!.key} is still named by ${left.map((r) => r.at ?? r.by).join(', ')}: change those first`,
    );
  const before = fresh(path, was);
  if (row) {
    let doc: any;
    try {
      doc = JSON.parse(before);
    } catch {
      refuse(400, `${file} is not JSON: fix it first`);
    }
    if (!Object.hasOwn(doc?.[section] ?? {}, key)) refuse(400, `${file} has no ${key}`);
    delete doc[section][key];
    return done(t, `delete ${section} ${key}`, [{ file, before, after: json(doc) }]);
  }
  const changes: Change[] = [{ file, before, after: null }];
  const room = placed(file)?.dir === 'rooms' ? placed(file)!.key : undefined;
  const layout = current(join(t.root, 'layout.json')); // another file's room matches no row
  try {
    const rows = JSON.parse(layout ?? 'null');
    const kept = Array.isArray(rows) ? rows.filter((r) => r?.room !== room) : rows;
    if (kept?.length < rows?.length)
      changes.push({ file: 'layout.json', before: layout, after: kept.length ? json(kept) : null });
  } catch {
    // a layout.json that is not JSON is the compile's to report
  }
  return done(t, `delete ${file}`, changes);
}

function move(t: Tree, { file, was, area }: Sent) {
  const path = guarded(t.root, file, 'read');
  const at = placed(file) ?? refuse(400, `${file} is not a definition file`);
  if (area !== null && !named(area)) refuse(400, 'area: [a-z0-9_]+, or null for the root');
  const target = `${area ? `areas/${area}/` : ''}${at.dir}/${at.key}.${at.ext}`;
  guarded(t.root, target, 'create');
  const bytes = fresh(path, was);
  return done(t, `move ${file} to ${target}`, [
    { file: target, before: null, after: bytes },
    { file, before: bytes, after: null },
  ]);
}

function undo(t: Tree, { id }: Sent) {
  const entry = t.journal.find((e) => e.id === id) ?? refuse(404, `no journal entry ${id}`);
  for (const c of entry.files) {
    const path = guarded(t.root, c.file, there(join(t.root, c.file)) ? 'read' : 'create');
    const bytes = current(path);
    if (bytes !== c.after) refuse(409, { file: c.file, bytes, sha256: sha256(bytes) });
  }
  const back = entry.files.map((c) => ({ file: c.file, before: c.after, after: c.before }));
  return done(t, `undo ${entry.what}`, back);
}

async function create(t: Tree, { kind, name, from, area, extends: up }: Sent): Promise<Answer> {
  const fromOk = from === undefined || (named(from?.room) && named(from?.direction));
  const optional = (v: unknown) => v == null || named(v);
  if (!named(kind) || !named(name) || !fromOk || !optional(area) || !optional(up))
    refuse(400, 'kind, name, area, extends, from.room and from.direction: [a-z0-9_]+');
  // mix writes past guarded() (the area, its companions, --from's folder); no link anywhere keeps
  // every write inside the tree and in the snapshot the journal diffs (a link reads as no file).
  const link = files(t.root).find((rel) => there(join(t.root, rel))?.isSymbolicLink());
  if (link) refuse(400, `a symlink on the way to ${link}`);
  t.busy++;
  try {
    const before = t.snapshot();
    const refused = await loka([
      kind,
      name,
      ...(from ? ['--from', from.room, from.direction] : []),
      ...(area ? ['--area', area] : []),
      ...(up ? ['--extends', up] : []),
      t.root,
    ]);
    if (refused !== undefined) refuse(400, refused);
    const changes = diff(before, t.snapshot());
    return [
      200,
      {
        id: record(t, `new ${kind} ${name}`, 'editor', changes),
        files: changes.map((c) => c.file),
      },
    ];
  } finally {
    t.busy--;
  }
}

/** The abstract NPCs and items a drag may extend (`bin/loka new --extends`): files at the root or
 * in an area folder; the compile drops them, so /story has none.
 * ponytail: walks and parses every npcs/items file per story change; cache by the watcher's bursts when slow. */
const templates = (root: string) =>
  files(root).flatMap((rel) => {
    const at = placed(rel);
    if (at?.ext !== 'json' || (at.dir !== 'npcs' && at.dir !== 'items')) return [];
    if (there(join(root, rel))?.isSymbolicLink()) return []; // read nothing outside the tree
    try {
      const doc = JSON.parse(readFileSync(join(root, rel), 'utf8'));
      return doc?.abstract === true ? [{ dir: at.dir, key: at.key }] : [];
    } catch {
      return []; // mutate-skip: a half-written file is the compile's to report
    }
  });

let defs: { $defs: unknown } | undefined;
/** A `.scene`'s dialogue words in the last compile (the push carries only changed keys), for the
 * Scene card's Edit in Book: `dialogue.<key>.` and its nested sets' `dialogue.<key>_`. */
function sceneText(artifact: string | undefined, key: string) {
  if (!artifact || !existsSync(artifact)) return {};
  const { text } = JSON.parse(JSON.parse(readFileSync(artifact, 'utf8')).canonical);
  return Object.fromEntries(
    Object.entries(text as Record<string, string>).filter(([k]) =>
      [`dialogue.${key}.`, `dialogue.${key}_`].some((p) => k.startsWith(p)),
    ),
  );
}
type Last = { places: Record<string, string>; artifact?: string };
function get(t: Tree, url: string, { places, artifact }: Last): Answer | undefined {
  const { pathname, searchParams } = new URL(url, 'http://localhost');
  if (pathname === '/source') {
    const rel = searchParams.get('file');
    const bytes = readFileSync(guarded(t.root, rel, 'read'), 'utf8');
    const at = placed(rel!);
    const kind = at?.dir ?? rel!.split(/[/.]/)[0];
    const text = at?.ext === 'scene' ? { text: sceneText(artifact, at.key) } : {};
    return [
      200,
      { bytes, sha256: sha256(bytes), kind, key: at?.key ?? null, area: at?.area ?? null, ...text },
    ];
  }
  const schema = /^\/schema\/([a-z_]+)$/.exec(pathname)?.[1];
  if (schema !== undefined) {
    if (![...DIRS, ...ROOTS, 'areas'].includes(schema)) return [404, `no source schema ${schema}`];
    defs ??= JSON.parse(readFileSync(join(SCHEMAS, 'defs.schema.json'), 'utf8'));
    const stub = JSON.parse(readFileSync(join(SCHEMAS, `${schema}.schema.json`), 'utf8'));
    return [
      200,
      { ...stub, $ref: stub.$ref.replace(/^defs\.schema\.json/, ''), $defs: defs!.$defs },
    ];
  }
  if (pathname === '/line')
    return located(t.root, searchParams.get('key') ?? '', searchParams.get('words') ?? '', places);
  if (pathname === '/world') return worlds(t.root);
  if (pathname === '/templates') return [200, templates(t.root)];
  if (pathname === '/journal')
    return [200, t.journal.map(({ files: fs, ...e }) => ({ ...e, files: fs.map((c) => c.file) }))];
}

type Post = (t: Tree, sent: Sent, artifact?: string) => Answer | Promise<Answer>;
const POSTS: Record<string, Post> = {
  '/change': change,
  '/edit': (t, sent) => edit(t.root, sent, (what, c) => done(t, what, [c])),
  '/set': (t, sent, artifact) =>
    set(
      t.root,
      sent,
      () => ids(compiledCartridge(artifact)),
      (what, c) => done(t, what, [c]),
    ),
  '/delete': remove,
  '/move': move,
  '/undo': undo,
  '/new': create,
  '/world': opened,
};
export const writes = (url: string) => Object.hasOwn(POSTS, url);

async function answered<A extends Answer | undefined>(run: () => A | Promise<A>): Promise<A> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof Refused) return [e.status, e.body] as A;
    throw e;
  }
}

/** The write path over one source tree; `push` carries each write's `changed` to the page and
 * `places` is the last compile's `~` key => file:line and `artifact` its file. */
export function writer(
  source: string,
  push: (changed: Changed[]) => void,
  places: () => Record<string, string> = () => ({}),
  artifact?: string,
) {
  const t = tree(source, push);
  return {
    get: (url: string) => answered(() => get(t, url, { places: places(), artifact })),
    // a write during /new's seconds-long run would land in its snapshot diff, and so its undo
    post: (url: string, sent: Sent) =>
      answered(() => (t.busy ? refuse(409, 'a /new is running') : POSTS[url](t, sent, artifact))),
    /** After an fs burst: what changed outside the editor is journaled and pushed `outside`.
     * ponytail: rereads every source file per burst; fine at showcase size, hash by mtime when not. */
    busy: () => t.busy > 0,
    seen() {
      if (t.busy) return;
      const changes = diff(t.cache, t.snapshot());
      if (changes.length) record(t, 'outside', 'outside', changes);
    },
  };
}
