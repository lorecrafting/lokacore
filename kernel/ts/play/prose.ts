// POST /edit (loka-vduxr.53): one line of words in place, for E5's in-Book editing. Only the
// words change: a JSON string literal (with its key and comma kept) or a scene's `* ` line.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { guarded, refuse, stale } from './guard.ts';
import { files } from './todo.ts';
import type { Answer, Change } from './write.ts';

const LITERAL = /^(\s*(?:"(?:[^"\\]|\\.)*"\s*:\s*)?)("(?:[^"\\]|\\.)*")(\s*,?\s*)$/;

/** The line with its words replaced, or the reason it is not a line of words. */
export function worded(rel: string, line: string, words: string) {
  if (rel.endsWith('.json')) {
    const literal = LITERAL.exec(line);
    return literal
      ? `${literal[1]}${JSON.stringify(words)}${literal[3]}`
      : refuse(400, 'not a line of words');
  }
  if (rel.endsWith('.cut'))
    return line.trim() && line.trim() !== '---' ? words : refuse(400, 'not a line of words');
  const said = /^(\s*\* ).*$/.exec(line);
  if (said) return `${said[1]}${words}`;
  return refuse(400, /^\s*- /.test(line) ? 'a choice label: its key is its words' : 'a key line');
}

export function edit(
  root: string,
  { file, line, was, words }: Record<string, any>,
  done: (what: string, change: Change) => Answer,
) {
  const path = guarded(root, file, 'read');
  if (typeof was !== 'string' || typeof words !== 'string' || /[\n\r\t]/.test(words))
    refuse(400, 'was and words: one line each, no tab');
  const before = readFileSync(path, 'utf8');
  const lines = before.split('\n');
  if (!Number.isInteger(line) || line < 1 || line > lines.length) refuse(400, 'no such line');
  if (lines[line - 1] !== was) stale(before);
  lines[line - 1] = worded(file, was, words);
  return done(`edit ${file}:${line}`, { file, before, after: lines.join('\n') });
}

export function sourceOf(source: string, key: string, words?: string) {
  const all = files(source);
  const find = (hit: (line: string) => boolean, rels = all) => {
    for (const rel of rels) {
      const i = readFileSync(join(source, rel), 'utf8').split('\n').findIndex(hit);
      if (i >= 0) return `${rel}:${i + 1}`;
    }
  };
  const defined = find((l) => l.includes(`"${key}":`));
  const first = words?.trim().split('\n')[0];
  if (defined || !first) return defined;
  return (
    find((l) => l.includes(JSON.stringify(words))) ??
    find(
      (l) =>
        l.trimEnd().endsWith(`: ${first}`) ||
        [`- ${first}`, `* ${first}`, first].includes(l.trim()),
      all.filter((rel) => /\.(scene|cut)$/.test(rel)),
    )
  );
}

/** GET /line?key=&words=: the source line a Book line's field writes (`sourceOf`), with its words
 * as written, or the reason it holds none (`worded`'s). */
export function located(root: string, key: string, words: string): Answer {
  const at = sourceOf(root, key, words) ?? refuse(404, `no source line for ${key}`);
  const [file, n] = [at.slice(0, at.lastIndexOf(':')), Number(at.slice(at.lastIndexOf(':') + 1))];
  const was = readFileSync(guarded(root, file, 'read'), 'utf8').split('\n')[n - 1];
  worded(file, was, ''); // refuses a line that is not words
  const literal = file.endsWith('.json') && LITERAL.exec(was);
  const own = literal
    ? JSON.parse(literal[2])
    : file.endsWith('.cut')
      ? was
      : was.replace(/^\s*\* /, '');
  return [200, { file, line: n, was, words: own }];
}
