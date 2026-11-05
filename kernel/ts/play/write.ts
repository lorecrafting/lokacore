// The editor's write path (docs/system/cartridge.md#author-preview): `GET /source`, `/schema/<dir>`
// and `/journal`, and the POST routes that change the source tree. Every path a body names goes
// through `guarded` (guard.ts) once; every write is a `.tmp` and a rename, recorded in the journal
// `/undo` puts back from. live.ts checks Host and Origin first.
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { files } from './todo.ts';
import {
  type Bytes,
  current,
  DIRS,
  guarded,
  named,
  placed,
  REPO,
  refuse,
  Refused,
} from './guard.ts';
import { ROOTS, SCHEMAS, rootFile, sha256, stale, there } from './guard.ts';
import { apply, Refused as EditRefused } from './edit_model.ts';
import { edit, located } from './prose.ts';

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
  for (const op of ops)
    try {
      apply(doc, op);
    } catch (e) {
      if (!(e instanceof EditRefused)) throw e;
      refuse(400, e.message);
    }
  return done(t, `change ${file}`, [{ file, before, after: json(doc) }]);
}

function remove(t: Tree, { file, was }: Sent) {
  const path = guarded(t.root, file, 'read');
  if (!file.includes('/') || rootFile(file))
    refuse(400, `${file} is a root file: delete its rows, not the file`);
  const changes: Change[] = [{ file, before: fresh(path, was), after: null }];
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

const loka = (args: string[]) =>
  new Promise<string | undefined>((resolve) =>
    execFile('mise', ['exec', '--', 'mix', 'loka.new', ...args], { cwd: REPO }, (error, _, err) =>
      resolve(error ? `${err}`.trim().split('\n').at(-1) || error.message : undefined),
    ),
  );
async function create(t: Tree, { kind, name, from, area }: Sent): Promise<Answer> {
  const fromOk = from === undefined || (named(from?.room) && named(from?.direction));
  if (!named(kind) || !named(name) || !fromOk || !(area == null || named(area)))
    refuse(400, 'kind, name, area, from.room and from.direction: [a-z0-9_]+');
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

let defs: { $defs: unknown } | undefined;
function get(t: Tree, url: string, places: Record<string, string>): Answer | undefined {
  const { pathname, searchParams } = new URL(url, 'http://localhost');
  if (pathname === '/source') {
    const rel = searchParams.get('file');
    const bytes = readFileSync(guarded(t.root, rel, 'read'), 'utf8');
    const at = placed(rel!);
    const kind = at?.dir ?? rel!.split(/[/.]/)[0];
    return [
      200,
      { bytes, sha256: sha256(bytes), kind, key: at?.key ?? null, area: at?.area ?? null },
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
  if (pathname === '/journal')
    return [200, t.journal.map(({ files: fs, ...e }) => ({ ...e, files: fs.map((c) => c.file) }))];
}

const POSTS: Record<string, (t: Tree, sent: Sent) => Answer | Promise<Answer>> = {
  '/change': change,
  '/edit': (t, sent) => edit(t.root, sent, (what, c) => done(t, what, [c])),
  '/delete': remove,
  '/move': move,
  '/undo': undo,
  '/new': create,
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
 * `places` is the last compile's `~` key => file:line. */
export function writer(
  source: string,
  push: (changed: Changed[]) => void,
  places: () => Record<string, string> = () => ({}),
) {
  const t = tree(source, push);
  return {
    get: (url: string) => answered(() => get(t, url, places())),
    // a write during /new's seconds-long run would land in its snapshot diff, and so its undo
    post: (url: string, sent: Sent) =>
      answered(() => (t.busy ? refuse(409, 'a /new is running') : POSTS[url](t, sent))),
    /** After an fs burst: what changed outside the editor is journaled and pushed `outside`.
     * ponytail: rereads every source file per burst; fine at showcase size, hash by mtime when not. */
    seen() {
      if (t.busy) return;
      const changes = diff(t.cache, t.snapshot());
      if (changes.length) record(t, 'outside', 'outside', changes);
    },
  };
}
