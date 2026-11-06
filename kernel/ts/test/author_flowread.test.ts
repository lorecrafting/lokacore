// The Flow graph's reads (tools/author-panel/src/flowread.ts): ink, search, the card, keys and the
// palette rows, worked by hand on the planted models of author_flow_fixture.ts (rulings S3).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layout } from '../../../tools/author-panel/src/flow.ts';
import * as read from '../../../tools/author-panel/src/flowread.ts';
import { LAYOUT } from '../../../tools/author-panel/src/shell.ts';
import { d1, d2, d3, f, model, OPEN, planted, q, r1, thera, V } from './author_flow_fixture.ts';

// Breaks: focus walks through the NPC anchor (d1 and thera both read it) or by one hop too many
// (rulings S3 Focus: a stub must not light unrelated cells).
test('focus ink walks lane edges only, by exactly the hops', () => {
  assert.deepEqual([...read.focusInk(V, d1, 1)].sort(), [d1, d2, d3, f].sort());
  assert.deepEqual([...read.focusInk(V, d1, 2)].sort(), [d1, d2, d3, f, r1].sort());
});

// Breaks: search answers blank text, misses a fact key, a kind or an edge path, or is case bound.
test('search: blank is no search; by fact key, kind and edge path', () => {
  assert.equal(read.search(planted, '  '), undefined);
  assert.deepEqual([...read.search(planted, ' F ')!].sort(), [d1, f, r1].sort());
  assert.deepEqual([...read.search(planted, 'fail')!], [d1]);
  assert.deepEqual([...read.search(planted, 'reaction')!].sort(), [r1, thera].sort());
});

// Breaks: the card's verbs, its dedupe, its F.rows cap or its `more` count change, or depends
// drops the condition or the anchor.
test("d1's card in V: six of seven rows, the condition and the NPC in depends", () => {
  assert.deepEqual(read.card(V, d1), {
    rows: ['then → d2', 'fail → d3', 'reads f', 'then → d1', '← d2', '← d3'],
    more: 1,
    depends: ['fact_compare', 'aldous'],
  });
  const set = model([r1, f], [{ from: r1, to: f, path: '/set', set: true }]);
  assert.deepEqual(read.card(set, r1), { rows: ['sets f'], more: 0, depends: [] });
});

// Breaks: a key from a missing id moves, PageUp/PageDown miss the next part, Backspace takes the
// unsorted first inbound, an arrow reads the wrong grid row, or Tab ignores the selection.
test('keys: missing id, PageUp/PageDown, Backspace, arrows over lanes, Tab with a selection', () => {
  const fl = layout(planted, OPEN);
  assert.equal(read.step(planted, fl, 'nope', 'Home'), undefined);
  assert.equal(read.step(planted, fl, d1, 'PageDown'), 'count:unplaced|reaction');
  assert.equal(read.step(planted, fl, 'count:unplaced|fact', 'PageUp'), q);
  assert.equal(read.step(planted, fl, d1, 'PageUp'), undefined);
  assert.equal(read.step(V, layout(V, OPEN), d1, 'Backspace'), d1);
  assert.equal(read.step(planted, fl, d2, 'Backspace'), d1);
  assert.equal(read.step(planted, fl, d2, 'ArrowDown'), d3);
  assert.equal(read.step(planted, fl, d3, 'ArrowDown'), 'count:unplaced|reaction');
  assert.equal(read.step(planted, fl, 'count:unplaced|fact', 'ArrowUp'), 'count:unplaced|reaction');
  assert.equal(read.entry(fl, d3), d3);
  assert.equal(read.entry(fl, f), 'count:unplaced|fact');
  assert.equal(read.entry(fl, 'nope'), q);
});

// Breaks: the palette lacks a fact's follow row, collapse or expand misses a part, unfollow drops
// the filters, or a story or beat row leaves Flow while Flow is shown (S4).
test('palette rows: follow per fact, collapse and expand, unfollow, and story and beat rows in Flow', () => {
  assert.deepEqual(
    read.flowItems(planted).map((i) => [i.label, i.id]),
    [
      ['flow: collapse all', 'flow:collapse'],
      ['flow: expand all', 'flow:expand'],
      ['follow f', `follow:${f}`],
      ['unfollow', 'unfollow'],
    ],
  );
  const l = { ...LAYOUT, leftOpen: false, map: 'flow' as const };
  assert.deepEqual(read.flowGo(planted, l, 'flow:collapse')!.story!.fold, ['part:0']);
  assert.deepEqual(read.flowGo(planted, l, 'flow:expand')!.story!.fold, ['unplaced']);
  assert.equal(read.flowGo(planted, l, 'flow:expand')!.leftOpen, true);
  const off = read.flowGo(planted, { ...l, flow: { follow: f, filters: ['quest'] } }, 'unfollow')!;
  assert.deepEqual(off.flow, { follow: undefined, filters: ['quest'] });
  const s = { ...planted, files: { [d1]: 'dialogue/d1.json' } };
  const sel = read.flowGo(s, l, `story:${d1}`)!;
  assert.deepEqual(
    [sel.map, sel.selection],
    ['flow', { file: 'dialogue/d1.json', kind: 'dialogue', key: 'd1' }],
  );
  const beat = read.flowGo(s, { ...l, story: { fold: ['part:0'] } }, 'beat:2')!;
  assert.equal(beat.map, 'flow');
  assert.equal(beat.story!.fold.includes('part:0'), false);
  assert.equal(read.flowGo(s, { ...l, map: 'story' }, `story:${d1}`), undefined);
  assert.equal(read.flowGo(s, l, `trace:${f}`), undefined);
});
