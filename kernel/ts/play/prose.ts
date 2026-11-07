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
const MARK = '\u0000line';
/** JSON file `rel`'s value at `steps` (`room` a `room_line`'s, prose.ex step/1), with the `words`
 * at column `i` of line `n` marked first; null while it does not parse (a half-saved file). */
function valueAt(source: string, rel: string, steps: string[], words = '', n = -1, i = 0) {
  const lines = readFileSync(join(source, rel), 'utf8').split('\n');
  const was = JSON.stringify(words);
  if (n >= 0)
    lines[n] = lines[n].slice(0, i) + JSON.stringify(MARK) + lines[n].slice(i + was.length);
  try {
    return steps.reduce(
      (at: any, step, k) =>
        at?.[k === steps.length - 1 && step === 'room' && at?.room_line ? 'room_line' : step],
      JSON.parse(lines.join('\n')),
    );
  } catch {
    return null;
  }
}
/** Whether marking one place `words` stand on line `n` (a label keyed by its words, two fields on
 * one line) marks the value at `steps`: a string or an inline `{"prose"}`; a half-saved file, yes. */
function marked(source: string, rel: string, steps: string[], words: string, n: number) {
  const [line, was] = [
    readFileSync(join(source, rel), 'utf8').split('\n')[n],
    JSON.stringify(words),
  ];
  for (let i = line.indexOf(was); i >= 0; i = line.indexOf(was, i + 1)) {
    const value = valueAt(source, rel, steps, words, n, i);
    if (value === null || value === MARK || value?.prose === MARK) return true;
  }
  return false;
}
/** An inline prose key `<kind>.<key>.<path>`'s `hits` that its own definition holds at that path:
 * the same words elsewhere (a keyword, another room, its other fields) are not its line. With its
 * definition holding other words there (edited outside the Book), none: never another's line. */
function own(source: string, key: string, words: string, hits: string[], all: string[]) {
  const [kind, name, ...path] = key.split('.');
  const fits = (dir: string, k: string) =>
    k === name && [kind, `${kind}s`, `${kind}es`].includes(dir);
  const ownFile = (rel: string) => {
    const placing = placed(rel); // an area bundle places as `areas/<a>`: its members below
    return !!placing && fits(placing.ext === 'scene' ? 'dialogues' : placing.dir, placing.key);
  };
  const mine = all.filter(ownFile);
  const [bundle] = mine.length
    ? []
    : Object.entries(bundled(source)).filter(([ref]) =>
        fits(...(ref.split('/') as [string, string])),
      );
  if (!mine.length && !bundle) return hits; // a kind with no file of its own: search them all
  const steps = (rel: string) =>
    ownFile(rel) ? path : rel === bundle?.[1] ? [bundle[0].split('/')[0], name, ...path] : null;
  // a JSON hit is the key's when marking its words on that line marks the key's own words
  const holds = (at: string) => {
    const [rel, s] = [fileOf(at), steps(fileOf(at))];
    if (!s || !rel.endsWith('.json')) return !!s; // a scene: its own file
    return marked(source, rel, s, words, Number(at.slice(at.lastIndexOf(':') + 1)) - 1);
  };
  const kept = hits.filter(holds);
  // a half-saved own file (null) cannot tell either: as with nothing there, every hit
  const defines = (rel: string) =>
    !rel.endsWith('.json') || valueAt(source, rel, steps(rel)!) != null;
  // nothing there: words it inherits (`extends`) are wherever they are found
  return kept.length || [...mine, ...(bundle ? [bundle[1]] : [])].some(defines) ? kept : hits;
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
