// POST /edit (loka-vduxr.53): one line of words in place, for E5's in-Book editing. Only the
// words change: a JSON string literal (with its key and comma kept) or a scene's `* ` line.
import { readFileSync } from 'node:fs';
import { guarded, refuse, stale } from './guard.ts';
import type { Answer, Change } from './write.ts';

const LITERAL = /^(\s*(?:"(?:[^"\\]|\\.)*"\s*:\s*)?)"(?:[^"\\]|\\.)*"(\s*,?\s*)$/;

/** The line with its words replaced, or the reason it is not a line of words. */
export function worded(rel: string, line: string, words: string) {
  if (rel.endsWith('.json')) {
    const literal = LITERAL.exec(line);
    return literal
      ? `${literal[1]}${JSON.stringify(words)}${literal[2]}`
      : refuse(400, 'not a line of words');
  }
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
