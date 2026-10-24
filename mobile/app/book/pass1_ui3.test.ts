// Pass-1 UI3 (book-ui.md, World and status entry; Map): the Map draws no log (UF1), a door's state
// line only when no exit card already carries it (UF2), and a shut door's Open also on World (R4).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';

// Breaks: the Map draws the log again (UF1); the door line repeats the exit card's "closed" or
// "locked", or drops while the door is open (UF2); World draws a door card again (owner 2026-10-23
// reverses R4: doors work from the Map and the joystick), or a repeat Map press sends another command.
test('doors sampler lane: Map door lines, none on World, after closing the hut door', (t) => {
  const b = book(compiled('cartridges/doors_sampler') as never);
  t.after(() => b.sql.close());
  const sent: unknown[] = [];
  const invoke = b.game.invoke;
  b.game.invoke = (c) => (sent.push({ ...c, view_freshness_token: undefined }), invoke(c));
  assert.ok(!b.labels().includes('Close the hut door (north)'));
  b.map();
  const before = b.text();
  assert.ok(before.includes('The hut door: open'));
  assert.ok(before.includes('East: locked'));
  assert.ok(!before.includes('The gate: locked'));
  b.tap('Close the hut door (north)');
  const map = b.text();
  assert.ok(map.includes('North: closed'));
  assert.ok(!map.includes('The hut door: closed'));
  assert.ok(!map.includes('Closed.'), JSON.stringify(map));
  b.tap('Back to World');
  const world = b.text();
  assert.ok(world.includes('Closed.'));
  assert.ok(!world.includes('Open the hut door (north)'), JSON.stringify(world));
  b.map();
  b.tap('Open the hut door (north)');
  b.tap('Close the hut door (north)');
  b.tap('Open the hut door (north)');
  assert.deepEqual(sent[1], sent[3]);
  assert.deepEqual(sent[3], {
    action_key: 'open',
    target_ids: [],
    input: { direction: 'north' },
    view_freshness_token: undefined,
  });
});
