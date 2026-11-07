// POST /edit (loka-vduxr.53): one line of words in place, for E5's in-Book editing. Only the
// words change: a JSON string literal (with its key and comma kept) or a scene's `* ` line.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { guarded, placed, refuse, stale } from './guard.ts';
import { bundled, files } from './todo.ts';
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
  const hits = [
    ...find((l) => l.includes(JSON.stringify(words))),
    ...find(
      (l) =>
        l.trimEnd().endsWith(`: ${first}`) ||
        [`- ${first}`, `* ${first}`, first].includes(l.trim()),
      all.filter((rel) => /\.(scene|cut)$/.test(rel)),
    ),
  ];
  return own(source, key, words!, hits, all);
}
const fileOf = (at: string) => at.slice(0, at.lastIndexOf(':'));
const lineOf = (source: string, at: string, back = 0) =>
  readFileSync(join(source, fileOf(at)), 'utf8').split('\n')[
    Number(at.slice(at.lastIndexOf(':') + 1)) - 1 - back
  ];
/** An inline prose key `<kind>.<key>.<field>`'s `hits` on its own definition's field line: the
 * same words elsewhere (a keyword, another room, its other fields) are not its line. With its
 * definition found but no such hit (words edited outside the Book), none: never another's line. */
function own(source: string, key: string, words: string, hits: string[], all: string[]) {
  const [kind, name, ...path] = key.split('.');
  const fits = (dir: string, k: string) =>
    k === name && [kind, `${kind}s`, `${kind}es`].includes(dir);
  const ownFile = (rel: string) => {
    const placing = placed(rel); // an area bundle places as `areas/<a>`: its members below
    return !!placing && fits(placing.ext === 'scene' ? 'dialogues' : placing.dir, placing.key);
  };
  const [bundle] = Object.entries(bundled(source)).filter(([ref]) =>
    fits(...(ref.split('/') as [string, string])),
  );
  // a bundle hit is its member's only while the member's own field still holds the words
  const member = (rel: string) =>
    !!bundle &&
    rel === bundle[1] &&
    [bundle[0].split('/')[0], name, ...path].reduce(
      (at: any, step) => at?.[step],
      JSON.parse(readFileSync(join(source, rel), 'utf8')),
    )?.prose === words;
  if (!bundle && !all.some(ownFile)) return hits; // a kind with no file of its own: search them all
  const field = path.at(-1);
  const named = (at: string) =>
    /\.(scene|cut)$/.test(fileOf(at)) ||
    !field ||
    /^\d+$/.test(field) ||
    lineOf(source, at).includes(`"${field}":`) ||
    (/^\s*"prose"\s*:/.test(lineOf(source, at)) &&
      !!lineOf(source, at, 1)?.includes(`"${field}":`));
  return hits.filter((at) => (ownFile(fileOf(at)) || member(fileOf(at))) && named(at));
}
export const sourceOf = (source: string, key: string, words?: string) =>
  sourcesOf(source, key, words)[0];
/** POST /open's line: the selection's own file (Cmd-E on a `.loka` or `.scene`) at its key's line
 * there, else its first; with no file, its key's. */
export const openAt = (source: string, sent: { key?: unknown; words?: string; file?: string }) =>
  sent.file && files(source).includes(sent.file)
    ? (sourcesOf(source, String(sent.key)).find((at) => at.startsWith(`${sent.file}:`)) ??
      `${sent.file}:1`)
    : sourceOf(source, String(sent.key), sent.words);

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
