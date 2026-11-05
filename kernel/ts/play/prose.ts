// POST /edit (loka-vduxr.53): one line of words in place, for E5's in-Book editing. Only the
// words change: a JSON string literal (with its key and comma kept) or a scene's `* ` line.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { guarded, refuse, stale } from './guard.ts';
import { files } from './todo.ts';
import type { Answer, Change } from './write.ts';

// a JSON string line, its key optional; an inline `"field": {"prose": "..."}` on one line too
const LITERAL =
  /^(\s*(?:"(?:[^"\\]|\\.)*"\s*:\s*)?(?:\{\s*"prose"\s*:\s*)?)("(?:[^"\\]|\\.)*")(\s*\}?\s*,?\s*)$/;

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

/** Every `file:line` that may write `key`: its `"key":` lines, else lines holding `words`
 * (as a JSON string, or a scene line that says their first line). */
export function sourcesOf(source: string, key: string, words?: string) {
  const all = files(source);
  const find = (hit: (line: string) => boolean, rels = all) =>
    rels.flatMap((rel) =>
      readFileSync(join(source, rel), 'utf8')
        .split('\n')
        .flatMap((l, i) => (hit(l) ? [`${rel}:${i + 1}`] : [])),
    );
  const defined = find((l) => l.includes(`"${key}":`));
  const first = words?.trim().split('\n')[0];
  if (defined.length || !first) return defined;
  // both kinds: a `~` scene line must not lose to some JSON `"~"` (located refuses two)
  return [
    ...find((l) => l.includes(JSON.stringify(words))),
    ...find(
      (l) =>
        l.trimEnd().endsWith(`: ${first}`) ||
        [`- ${first}`, `* ${first}`, first].includes(l.trim()),
      all.filter((rel) => /\.(scene|cut)$/.test(rel)),
    ),
  ];
}
export const sourceOf = (source: string, key: string, words?: string) =>
  sourcesOf(source, key, words)[0];

/** GET /line?key=&words=: the source line a Book line's field writes (the compile's `places` for
 * a `~` key: every `~` line holds the same words; else `sourceOf`), with its words as written, or
 * the reason it holds none (`worded`'s). */
export function located(
  root: string,
  key: string,
  words: string,
  places: Record<string, string> = {},
): Answer {
  const lineAt = (at: string) => {
    const [file, n] = [at.slice(0, at.lastIndexOf(':')), Number(at.slice(at.lastIndexOf(':') + 1))];
    return [file, n, readFileSync(guarded(root, file, 'read'), 'utf8').split('\n')[n - 1]] as const;
  };
  // an outside save that moved lines before the compile: the map's line no longer holds the words
  const fresh =
    Object.hasOwn(places, key) && lineAt(places[key])[2]?.includes(words.split('\n')[0]);
  const [at = refuse(404, `no source line for ${key}`), other] = fresh
    ? [places[key]]
    : sourcesOf(root, key, words);
  if (other) refuse(400, `more than one source line holds ${key}'s words`); // two `* ~` lines: which?
  const [file, n, was] = lineAt(at);
  // a `~` line names no key: with the map stale, the one `~` left may be another key's
  if (!fresh && words.trim() === '~' && !was.includes(`"${key}":`))
    refuse(409, `the source moved since the compile: wait for it to open ${key}`);
  worded(file, was, ''); // refuses a line that is not words
  const literal = file.endsWith('.json') && LITERAL.exec(was);
  const own = literal
    ? JSON.parse(literal[2])
    : file.endsWith('.cut')
      ? was
      : was.replace(/^\s*\* /, '');
  return [200, { file, line: n, was, words: own }];
}
