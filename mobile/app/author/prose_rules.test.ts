// Build's editing rules (docs/design/prose-in-the-book-rulings.md), apart from the DOM.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';
import { color } from '../book/tokens.ts';
import {
  bind,
  clicked,
  lost,
  nextPage,
  shortcut,
  noFieldNote,
  oneLine,
  paletteNear,
  relays,
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
  assert.equal(tagged('k.d', undefined as never), undefined); // Break: the Book throws on a key with no text
  assert.ok(unwritten(a) && unwritten(b) && unwritten(' ~ '));
  assert.ok(!unwritten('Rain ~') && !unwritten(''));
});

// Breaks: a walk stops at the last line instead of wrapping, or `[` from nothing lands first.
test('walk keys wrap, and stay out of text fields and Cmd, Ctrl, Alt', () => {
  assert.deepEqual([step(3, -1, 1), step(3, -1, -1), step(3, 2, 1), step(3, 0, -1)], [0, 2, 0, 2]);
  assert.equal(step(0, -1, 1), -1);
  assert.equal(step(3, 0, 1), 1);
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
  for (const held of ['altKey', 'ctrlKey', 'metaKey'])
    assert.equal(walk(key(']', { [held]: true }), false), undefined);
  assert.equal(walk(key('toString'), false), undefined);
});

// Breaks: the panel keeps a walk key after a button click took the focus, relays a key typed in
// its own field, or relays Enter on a control (the Book opens a line while the control acts).
test("the panel hands the Book its walk keys and Enter, but not a field's or a control's", () => {
  const on = (tagName: string, isContentEditable = false) => ({ tagName, isContentEditable });
  const key = (k: string, mod = {}) => ({
    key: k,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    ...mod,
  });
  assert.ok(relays(key(']'), on('BUTTON')) && relays(key('Enter'), on('BODY')));
  assert.ok(!relays(key(']'), on('INPUT')) && !relays(key('['), on('DIV', true)));
  assert.ok(!relays(key('Enter'), on('BUTTON')) && !relays(key('Enter'), on('TEXTAREA')));
  assert.ok(!relays(key('Enter', { metaKey: true }), on('BODY')) && !relays(key('x'), on('BODY')));
  assert.ok(
    relays(key('z', { metaKey: true }), on('BUTTON')) &&
      !relays(key('z', { ctrlKey: true }), on('INPUT')),
  );
});

// Breaks: an engine line or a choice label gets the generic note.
test('a line with no field says why', () => {
  assert.equal(noFieldNote('item.taken'), 'The engine writes this line.');
  assert.equal(
    noFieldNote('room.a', 'a choice label: reword it in the scene card'),
    "A choice's words are edited in the scene card. Alt-click opens the scene.",
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

// Breaks: an import of Build's modules (its field, page hooks and sheets) that is not the
// author-preview require, so a player build holds them.
test('only the gated require reaches the builder', () => {
  const hits = execFileSync(
    'git',
    ['grep', '-nE', String.raw`['"](\.{1,2}/)+(author/)?build/`, '--', '*.ts', '*.tsx'],
    { cwd: join(import.meta.dirname, '..'), encoding: 'utf8' },
  )
    .split('\n')
    .filter((l) => l && !/^author\/build\/|\.test\.tsx?:|typeof import\(|import type /.test(l));
  assert.deepEqual(
    hits.map((l) => l.replace(/:\d+:\s*/, ': ')),
    [
      "author/panel.tsx: process.env.EXPO_PUBLIC_LOKA_DEV_CARTRIDGE === '1' ? require('./build/Build.tsx') : undefined;",
    ],
  );
});

// Breaks: a Book Cmd-Z or walk key goes to the panel (two undos), a panel shortcut stays in the
// Book.
test('the Book hands the panel its shortcuts', () => {
  const key = (k: string, mod = {}) => ({
    key: k,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    ...mod,
  });
  assert.deepEqual(
    ['k', '.', 'e', '\\', '/'].map((k) => shortcut(key(k, { metaKey: true }))),
    ['k', '.', 'e', '\\', '/'],
  );
  assert.equal(shortcut(key('k', { ctrlKey: true })), 'k');
  for (const asked of [
    key('z', { metaKey: true }),
    key(']'),
    key('k'),
    key('k', { metaKey: true, altKey: true }),
  ])
    assert.equal(shortcut(asked), undefined);
});

// Breaks: a click on a title cap() drew selects nothing (exact words only); Alt-click opens the
// drawn capital, not the file's words; the exact or the lowered form wins when both name a key
// (journal_sampler's oar: the quest title's field opens on the item's title); or words two keys
// draw bind to the last key drawn.
test("a clicked line's key: its words or the capital lowered, none when two keys claim it", () => {
  const seen = new Map<string, string>(),
    said = new Map([['item.lantern.name', 'brass lantern']]);
  bind(seen, 'brass lantern', 'item.lantern.name');
  assert.deepEqual(clicked(seen, said, 'Brass lantern'), {
    key: 'item.lantern.name',
    words: 'brass lantern',
  });
  assert.deepEqual(clicked(seen, said, 'Not drawn'), { key: undefined, words: 'Not drawn' });
  bind(seen, 'the lost oar', 'item.oar.short');
  bind(seen, 'The lost oar', 'quest.oar.title');
  assert.equal(clicked(seen, said, 'The lost oar').key, undefined);
  assert.equal(clicked(seen, said, 'the lost oar').key, 'item.oar.short');
  bind(seen, 'the lost oar', 'item.oar.short');
  assert.equal(clicked(seen, said, 'the lost oar').key, 'item.oar.short', 'one key drawn twice');
  bind(seen, 'the lost oar', 'quest.oar.name');
  assert.equal(clicked(seen, said, 'the lost oar').key, undefined, 'two keys, one words');
  // Break: the probe misses the collision, so the measurement counts zero and the design note's
  // first step decides on nothing (loka-wfrgk.100.8). Both keys, once.
  assert.deepEqual([...(lost.get('the lost oar') ?? [])].sort(), [
    'item.oar.short',
    'quest.oar.name',
  ]);
  assert.equal(lost.has('brass lantern'), false, 'one key drawing words lost nothing');
  // Break: the probe records the "no field" mark ('') as a claimant, so a line already refused
  // reads as a fresh collision and every sample names '' instead of the keys that clashed.
  assert.deepEqual([...(lost.get('the lost oar') ?? [])].sort(), [
    'item.oar.short',
    'quest.oar.name',
  ]);
  // ...and a third key does not rewrite the pair: the collision already recorded is the real one.
  bind(seen, 'the lost oar', 'item.oar.other');
  assert.deepEqual([...(lost.get('the lost oar') ?? [])].sort(), [
    'item.oar.short',
    'quest.oar.name',
  ]);
});

// Break: the bindings outlive the page, so two keys that share a wording on one page cost that
// wording's field on every later page too -- the 'rest of the session' a PM report described. The
// showcase has 59 such families (`item.egg_01..04.bare` all draw 'egg'), none sharing a page.
test('a page change drops the bindings, so a later page opens its own field', () => {
  const seen = new Map<string, string>();
  bind(seen, 'egg', 'item.egg_01.bare');
  bind(seen, 'egg', 'item.egg_02.bare'); // both on this page: neither opens
  assert.equal(clicked(seen, new Map(), 'egg').key, undefined);
  nextPage(seen);
  bind(seen, 'egg', 'item.egg_03.bare'); // the next page draws one of them
  assert.equal(clicked(seen, new Map(), 'egg').key, 'item.egg_03.bare');
});
