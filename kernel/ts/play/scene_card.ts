// POST /set (docs/system/cartridge.md, Editor write path): a `.scene` file's one `npc:`, `with:`
// or `then:` value in place, a real key; POST /edit stays words only (prose.ts).
import { existsSync, readFileSync } from 'node:fs';
import { INSTALLED, loadCartridge } from '../src/index.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';
import { artifactBytes } from './compiled.ts';
import { guarded, named, placed, refuse, stale } from './guard.ts';
import { contentGraph } from './reach.ts';
import { picks, VALUE, type Verb } from './scene_lines.ts';
import { unlinkable } from './story_counts.ts';
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
  lines[line - 1] = `${head}${value}${end}`;
  return done(`set ${file}:${line}`, { file, before, after: lines.join('\n') });
}
