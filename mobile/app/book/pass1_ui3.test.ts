// Pass-1 UI3 (book-ui.md, World and status entry; Minimap; Map): the room list draws no door card,
// the footer's release unlocks, else opens, a shut door, Close and Lock are not drawn (owner
// 2026-10-30), and the Map draws no log or door lines (loka-wz6f). Every draw also runs the
// harness's stranded-verb check.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';
import { commandOf } from './buttons.ts';

const doorish = (l: string) => /door|gate\b/.test(l);

// Breaks: World or the Map draws a door card or line again (an open door's Close); the Map draws
// the log (UF1).
test('doors sampler lane: no door card on World or the Map', (t) => {
  const b = book(compiled('cartridges/doors_sampler') as never);
  t.after(() => b.sql.close());
  assert.deepEqual(b.labels().filter(doorish), []);
  b.go('north');
  b.go('south');
  const line = b.text().at(-1)!;
  b.map();
  const map = b.text();
  assert.ok(!map.includes(line), JSON.stringify(map));
  assert.ok(!map.some((l) => /^The (hut door|gate)/.test(l)), JSON.stringify(map));
  assert.deepEqual(b.labels().filter(doorish), [], JSON.stringify(b.labels()));
});

// Breaks: Close or Lock gets a card while the engine offers it; the release stops pressing Unlock,
// then Open, on a locked door; a press sends more than one command.
test('doors sampler hut door: no Close or Lock; the release unlocks, opens, then walks', (t) => {
  const b = book(compiled('cartridges/doors_sampler') as never);
  t.after(() => b.sql.close());
  const sent: string[] = [];
  const invoke = b.game.invoke;
  b.game.invoke = (c) => (sent.push((c as { action_key: string }).action_key), invoke(c));
  b.tap('A hut key, open');
  b.tap('Take a hut key');
  // The engine still offers Close, then Lock: press them as the Book would, outside any drawn control.
  for (const verb of ['close', 'lock']) {
    const f = b.draw().find((n) => n.type.name === 'Footer').props;
    const offered = f.door('north').find((x: never) => commandOf(x) === verb);
    assert.ok(offered, `${verb} not offered`);
    assert.deepEqual(b.labels().filter(doorish), [], JSON.stringify(b.labels()));
    f.press(offered);
  }
  const before = b.game.view().view.place.id;
  for (let i = 0; i < 3; i++) b.go('north');
  assert.deepEqual(sent.slice(sent.indexOf('close')), ['close', 'lock', 'unlock', 'open', 'move']);
  assert.notEqual(b.game.view().view.place.id, before);
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
