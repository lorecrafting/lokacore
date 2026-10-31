// Pass-1 UI3 (book-ui.md, World and status entry; Minimap; Map): the room list draws no door card,
// the footer draws every door verb its release does not press, and the Map draws no log or door
// lines (owner 2026-10-30, loka-wz6f). Every draw also runs the harness's stranded-verb check.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';

const doorish = (l: string) => /door|gate\b/.test(l);

// Breaks: World or the Map draws a door card or line outside the footer again; the Map draws the
// log (UF1).
test('doors sampler lane: door verbs only under the joystick; none on the Map', (t) => {
  const b = book(compiled('cartridges/doors_sampler') as never);
  t.after(() => b.sql.close());
  assert.deepEqual(b.labels().filter(doorish), ['Close the hut door (north)']);
  b.go('north');
  b.go('south');
  const line = b.text().at(-1)!;
  b.map();
  const map = b.text();
  assert.ok(!map.includes(line), JSON.stringify(map));
  assert.ok(!map.some((l) => /^The (hut door|gate)/.test(l)), JSON.stringify(map));
  assert.deepEqual(b.labels().filter(doorish), [], JSON.stringify(b.labels()));
});

// Breaks: an open door's Close or a closed door's Lock loses its card (the door could not be shut
// or locked); the release stops pressing Unlock, then Open; a repeat press sends another command.
test('doors sampler hut door: Close and Lock cards, then the release unlocks and opens', (t) => {
  const b = book(compiled('cartridges/doors_sampler') as never);
  t.after(() => b.sql.close());
  const sent: { action_key: string; input: unknown }[] = [];
  const invoke = b.game.invoke;
  b.game.invoke = (c) => (sent.push(c as never), invoke(c));
  b.tap('A hut key, open');
  b.tap('Take a hut key');
  b.tap('Close the hut door (north)');
  assert.deepEqual(b.labels().filter(doorish), ['Lock the hut door (north)']);
  b.tap('Lock the hut door (north)');
  assert.deepEqual(b.labels().filter(doorish), []); // locked: the release's Unlock is its control
  b.go('north');
  b.go('north');
  assert.deepEqual(b.labels().filter(doorish), ['Close the hut door (north)']);
  b.tap('Close the hut door (north)');
  b.go('north');
  assert.deepEqual(
    sent.filter((c) => c.action_key !== 'take').map((c) => [c.action_key, c.input]),
    [
      ['close', { direction: 'north' }],
      ['lock', { direction: 'north' }],
      ['unlock', { direction: 'north' }],
      ['open', { direction: 'north' }],
      ['close', { direction: 'north' }],
      ['open', { direction: 'north' }],
    ],
  );
});

// Breaks: one footer press on a shut door sends no command or more than one.
test('trial sampler: one footer press on the shut cell door sends one Open', (t) => {
  const b = book(compiled('cartridges/trial_sampler') as never);
  t.after(() => b.sql.close());
  const sent: { action_key: string; input: unknown }[] = [];
  const invoke = b.game.invoke;
  b.game.invoke = (c) => (sent.push(c as never), invoke(c));
  b.go('east');
  assert.deepEqual(
    sent.map((c) => [c.action_key, c.input]),
    [['open', { direction: 'east' }]],
  );
});
