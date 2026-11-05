// The editor write path's one path guard (docs/system/cartridge.md#author-preview) and the
// small pieces every route shares. Nothing here trusts a request body.
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, posix, resolve, sep } from 'node:path';
import { files } from './todo.ts';

export type Bytes = string | null; // null: no file there
export const REPO = resolve(import.meta.dirname, '../../..');
export const SCHEMAS = join(REPO, 'schemas/source');
export const ROOTS = ['cartridge', 'facts', 'text', 'resources', 'attributes', 'layout'];
// Source.classify's dirs: every source schema but the root files', defs and the area bundle's
export const DIRS = readdirSync(SCHEMAS)
  .map((f) => f.replace('.schema.json', ''))
  .filter((d) => ![...ROOTS, 'defs', 'areas'].includes(d));
const NAME = /^[a-z0-9_]+$/;
export const named = (v: unknown): v is string => typeof v === 'string' && NAME.test(v);

export const sha256 = (bytes: Bytes) =>
  bytes === null ? null : createHash('sha256').update(bytes).digest('hex');
export class Refused extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, body: unknown) {
    super(String(body));
    this.status = status;
    this.body = body;
  }
}
export const refuse = (status: number, body: unknown): never => {
  throw new Refused(status, body);
};
export const there = (path: string) => lstatSync(path, { throwIfNoEntry: false });
const real = (path: string) => {
  try {
    return realpathSync(path);
  } catch {
    return ''; // a dangling link
  }
};
export const current = (path: string): Bytes =>
  there(path)?.isFile() ? readFileSync(path, 'utf8') : null;
/** A 409's body: the file as it is now, for the panel to rebase on. */
export const stale = (bytes: Bytes) => refuse(409, { bytes, sha256: sha256(bytes) });

/** `<dir>/<key>.<ext>` or `areas/<area>/<dir>/<key>.<ext>` (`Source.classify`), else undefined. */
export function placed(rel: string) {
  const parts = rel.split('/');
  const area = parts.length === 4 && parts[0] === 'areas' && named(parts[1]) ? parts[1] : null;
  const [dir = '', file = ''] = area ? parts.slice(2) : parts.length === 2 ? parts : [];
  const [, key, ext] = /^([\w-]+)\.(json|scene|cut)$/.exec(file) ?? [];
  const fits =
    ext === 'json' ||
    (ext === 'scene' && (dir === 'scenes' || dir === 'dialogues')) ||
    (ext === 'cut' && dir === 'scenes');
  return key && DIRS.includes(dir) && fits ? { dir, key, ext, area } : undefined;
}
const rootFile = (rel: string) =>
  ROOTS.some((r) => rel === `${r}.json`) || /^areas\/[a-z0-9_]+\.json$/.test(rel);

/** The one path guard: `rel` a normal relative path under the (real) root with no symlink on the
 * way; for `read` a listed regular file, for `create` a free place a source file may take. */
export function guarded(root: string, rel: unknown, mode: 'read' | 'create'): string {
  if (
    typeof rel !== 'string' ||
    rel.includes('\0') ||
    rel.startsWith('/') ||
    posix.normalize(rel) !== rel
  )
    refuse(400, `not a source path: ${rel}`);
  const path = join(root, rel as string);
  if (!path.startsWith(root + sep)) refuse(400, `outside the source tree: ${rel}`);
  let parent = dirname(path);
  while (!there(parent)) parent = dirname(parent); // stops at the root at the latest
  if (real(parent) !== parent) refuse(400, `a symlink on the way to ${rel}`);
  const at = there(path);
  if (mode === 'create') {
    if (at) refuse(409, `${rel} exists`);
    if (!placed(rel as string) && !rootFile(rel as string))
      refuse(400, `not a source file's place: ${rel}`);
  } else if (!files(root).includes(rel as string)) refuse(404, `no source file ${rel}`);
  else if (!at?.isFile()) refuse(400, `not a regular file: ${rel}`);
  return path;
}
