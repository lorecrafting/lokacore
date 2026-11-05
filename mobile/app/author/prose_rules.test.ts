// E5's editing rules (docs/design/prose-in-the-book-rulings.md), apart from the DOM.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';
import { color } from '../book/tokens.ts';
import {
  noFieldNote,
  oneLine,
  paletteNear,
  saving,
  step,
  tagged,
  unwritten,
  walk,
} from './prose_rules.ts';

// Breaks: a pasted newline reaches /edit (a second line), or an untouched field writes a no-op.
test('a field saves one line, and only changed, non-empty words', () => {
  assert.equal(oneLine('a\r\nb\nc\td'), 'a b c d');
  assert.equal(saving('  ', 'x'), 'empty');
  assert.equal(saving('x', 'x'), 'unchanged');
  assert.equal(saving('x ~', 'x'), 'save');
});

// Breaks: two `~` lines on a page show the same text, so the second resolves to the first's key.
test('two `~` lines are told apart, and both still read as unwritten', () => {
  const [a, b] = [tagged('k.a', '~'), tagged('k.b', '~')];
  assert.notEqual(a, b);
  assert.equal(tagged('k.a', '~'), a);
  assert.equal(tagged('k.c', 'Rain'), 'Rain');
  assert.ok(unwritten(a) && unwritten(b) && unwritten(' ~ '));
  assert.ok(!unwritten('Rain ~') && !unwritten(''));
});

// Breaks: a walk stops at the last line instead of wrapping, or `[` from nothing lands first.
test('walk keys wrap, and stay out of text fields and Cmd, Ctrl, Alt', () => {
  assert.deepEqual([step(3, -1, 1), step(3, -1, -1), step(3, 2, 1), step(3, 0, -1)], [0, 2, 0, 2]);
  assert.equal(step(0, -1, 1), -1);
  const key = (k: string, mod = {}) => ({
    key: k,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    ...mod,
  });
  assert.deepEqual(walk(key(']'), false), [true, 1]);
  assert.deepEqual(walk(key('{'), false), [false, -1]);
  assert.equal(walk(key(']'), true), undefined);
  assert.equal(walk(key(']', { altKey: true }), false), undefined);
  assert.equal(walk(key('toString'), false), undefined);
});

// Breaks: an engine line or a choice label gets the generic note.
test('a line with no field says why', () => {
  assert.equal(noFieldNote('item.taken'), 'The engine writes this line.');
  assert.equal(
    noFieldNote('room.a', 'a choice label: its key is its words'),
    'A choice label is its key. Alt-click opens the scene.',
  );
  assert.equal(noFieldNote(undefined), 'Not a line of words. Alt-click opens its source.');
});

// Breaks: the marks take one palette's inks on every paper (a light warning on dark paper).
test('the marks take the palette nearest the page paper', () => {
  for (const p of Object.values(color)) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(p.bg.slice(i, i + 2), 16));
    assert.equal(paletteNear(`rgb(${r}, ${g}, ${b})`), p);
  }
});

// Breaks: an import of inbook.ts that is not the author-preview require, so a player build holds it
// (the export proof is in the PR: a static require put its sentinel in the web bundle).
test('only the gated require reaches the in-Book editor', () => {
  const hits = execFileSync('git', ['grep', '-n', 'inbook', '--', '*.ts', '*.tsx'], {
    cwd: join(import.meta.dirname, '..'),
    encoding: 'utf8',
  })
    .split('\n')
    .filter((l) => /['"]\.{1,2}\/(author\/)?inbook/.test(l) && !/typeof import\(/.test(l));
  assert.deepEqual(
    hits.map((l) => l.replace(/:\d+:\s*/, ': ')),
    [
      "author/panel.tsx: process.env.EXPO_PUBLIC_LOKA_DEV_CARTRIDGE === '1' ? require('./inbook.ts') : undefined;",
    ],
  );
});
