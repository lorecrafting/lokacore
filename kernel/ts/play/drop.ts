// Delete (POST /delete; in-game-builder-mode §4.9): shared by the panel's palette and the builder's
// sheet foot, over the same Io as the map's edits. Tested from kernel/ts/test/author_drop.test.ts.
import type { Io } from './mapedit.ts';

/** Deletes `key`'s file, or its row of a root file. A delete that takes other files (a return leg,
 * a template) names them with their shas once; `also` asks before the second try. Resolves to the
 * refusal to show, or '' when done or declined; rejects when the file cannot be read. */
export async function drop(
  io: Io,
  key: string,
  file: string,
  also: (files: string[]) => boolean | Promise<boolean>,
) {
  const { sha256 } = await io.source(file);
  const sent = { file, was: sha256, ...(!file.includes('/') && { key }) };
  let { ok, told } = await io.post('delete', sent);
  const set = (told as { set?: { file: string; sha256: string }[] } | null)?.set;
  if (set) {
    if (!(await also(set.map((m) => m.file)))) return '';
    const shas = Object.fromEntries(set.map((m) => [m.file, m.sha256]));
    ({ ok, told } = await io.post('delete', { ...sent, also: shas }));
  }
  return ok ? '' : typeof told === 'string' ? told : 'Changed outside: try again';
}
