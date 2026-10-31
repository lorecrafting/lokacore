// Pass-1 UI3 (book-ui.md, World and status entry; Map): World draws no door card and the Map draws
// no log or door lines (owner 2026-10-30, loka-wz6f); the footer's shut-door press sends one command.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';

// Breaks: World draws a door card again; the Map draws the log (UF1) or a door line again; one
// footer press on a shut door sends no command or more than one.
test('doors sampler lane: no door card on World or the Map', (t) => {
  const b = book(compiled('cartridges/doors_sampler') as never);
  t.after(() => b.sql.close());
  assert.ok(!b.labels().some((l) => /door|gate/.test(l)), JSON.stringify(b.labels()));
  b.go('north');
  b.go('south');
  const line = b.text().at(-1)!;
  b.map();
  const map = b.text();
  assert.ok(!map.includes(line), JSON.stringify(map));
  assert.ok(!map.some((l) => /^The (hut door|gate)/.test(l)), JSON.stringify(map));
  assert.ok(!b.labels().some((l) => /door|gate\b/.test(l)), JSON.stringify(b.labels()));
});

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
