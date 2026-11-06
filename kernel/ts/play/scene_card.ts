// POST /set (docs/system/cartridge.md, Editor write path): a `.scene` file's one `npc:`, `with:`
// or `then:` value in place, a real key; POST /edit stays words only (prose.ts).
import { readFileSync } from 'node:fs';
import { files } from './todo.ts';
import { guarded, named, placed, refuse, stale } from './guard.ts';
import { VALUE, type Verb } from './scene_lines.ts';
import type { Answer, Change } from './write.ts';

/** The keys a value line may name (the compile's npc and dialogue keys, by their files): an
 * NPC's for `npc:` and `with:` (no abstract one, the compile drops it); a dialogue's or `end`. */
export function ids(root: string, abstract: string[]): Record<Verb, string[]> {
  const at = files(root).flatMap((rel) => placed(rel) ?? []);
  const npcs = at.filter((p) => p.dir === 'npcs' && p.ext === 'json').map((p) => p.key);
  const said = at.filter((p) => p.dir === 'dialogues' || p.ext === 'scene').map((p) => p.key);
  const real = npcs.filter((k) => !abstract.includes(k));
  return { npc: real, with: real, then: [...said, 'end'] };
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
