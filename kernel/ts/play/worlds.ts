// The author server's worlds (docs/system/cartridge.md#author-preview): GET /world lists the
// cartridges beside the open one, POST /world opens or makes one; write.ts routes both.
import { execFile } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { named, REPO, refuse, there } from './guard.ts';
import type { Answer } from './write.ts';

type Sent = Record<string, any>;

/** `mix loka.new` with `args`: undefined when it wrote, else the last line it printed. */
export const loka = (args: string[]) =>
  new Promise<string | undefined>((resolve) =>
    execFile('mise', ['exec', '--', 'mix', 'loka.new', ...args], { cwd: REPO }, (error, _, err) =>
      resolve(error ? `${err}`.trim().split('\n').at(-1) || error.message : undefined),
    ),
  );

// Worlds are the cartridges beside the open one (cartridges/). A name is one folder there, never a
// path; a world is a real folder (no link) with a cartridge.json.
const world = (root: string, name: unknown) => {
  if (!named(name)) refuse(400, 'name: [a-z0-9_]+');
  const path = join(dirname(root), name as string);
  if (!there(path)?.isDirectory() || !there(join(path, 'cartridge.json'))?.isFile())
    refuse(404, `no world ${name}`);
  return path;
};
const titled = (path: string) => {
  try {
    const { title } = JSON.parse(readFileSync(join(path, 'cartridge.json'), 'utf8'));
    return typeof title === 'string' && title !== '~' ? title : undefined;
  } catch {
    return undefined; // a broken cartridge.json is listed by its folder name
  }
};
export function worlds(root: string): Answer {
  const names = readdirSync(dirname(root), { withFileTypes: true })
    .filter(
      (d) => d.isDirectory() && there(join(dirname(root), d.name, 'cartridge.json'))?.isFile(),
    )
    .map((d) => d.name)
    .sort();
  const list = names.map((name) => ({ name, title: titled(join(dirname(root), name)) ?? name }));
  return [200, { current: basename(root), worlds: list }];
}
/** POST /world `{name}` opens that world; with `new: true` it makes it first, a blank starter or
 * a copy `from` another world (mix loka.new, as `bin/loka new cartridge`). editing.ts restarts the
 * watcher on the answer's world once it is sent. */
export async function opened(
  t: { root: string; busy: number },
  { name, new: make, from }: Sent,
): Promise<Answer> {
  if (make !== true) return world(t.root, name) && [200, { world: name }];
  if (!named(name)) refuse(400, 'name: [a-z0-9_]+');
  const path = join(dirname(t.root), name);
  if (there(path)) refuse(409, `${name} exists`);
  const copy = from === undefined ? [] : ['--from', world(t.root, from)];
  t.busy++;
  try {
    const refused = await loka(['cartridge', path, ...copy]);
    if (refused !== undefined) refuse(400, refused);
    return [200, { world: name }];
  } finally {
    t.busy--;
  }
}
