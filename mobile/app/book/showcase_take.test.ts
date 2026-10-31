// The Homestead seed sack is a heavy fixture: the Book shows its unavailable Take with the cartridge's
// own label for the action, through the real authority and Book.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';

// Breaks: the showcase text lacks action.take (the card reads "action.take"); the card keeps the old
// "Take: too heavy to carry." form; it shows its reason before a press; a press reaches the engine;
// or the pressed card reads its reason twice (in its name and its hint).
test('farm yard: a too-heavy seed sack reads "Take"; a press sends nothing and says why', () => {
  const b = book(compiled('cartridges/toolbox_showcase') as never);
  for (const d of ['north', 'west', 'south']) {
    b.go(d);
  }
  b.tap('seed sack, open');
  const head = () => b.sql.prepare('SELECT revision FROM head').get()!.revision;
  const before = head();
  assert.ok(!b.text().some((t) => t.includes('too heavy')), JSON.stringify(b.text()));
  b.refuse('Take');
  assert.equal(head(), before);
  assert.ok(b.text().includes("Take\nIt's too heavy to carry."), JSON.stringify(b.text()));
  const card = b.draw().find((n) => n.props?.accessibilityState?.disabled);
  // Pressed, the name holds the reason (label in name), so the hint drops it: read once.
  assert.deepEqual(
    [card?.props.accessibilityLabel, card?.props.accessibilityHint],
    ["Take\nIt's too heavy to carry.", undefined],
  );
});

// Breaks: the Book collapses by name key (the Glade's pelts are pelt_01..03, one key each), so three
// "rabbit pelt" links show; or a Take leaves the count stale, so the other pelts are unreachable.
test('glade: three pelts are one link "Three rabbit pelts", and after a Take the sentence recounts', () => {
  const b = book(compiled('cartridges/toolbox_showcase') as never);
  for (const d of ['north', 'west', 'south', 'west']) {
    b.go(d);
  }
  assert.ok(b.text().includes('Three rabbit pelts are here.'));
  b.tap('Three rabbit pelts, open');
  b.tap(/^Take a rabbit pelt/);
  assert.ok(b.text().includes('Two rabbit pelts are here.'));
  assert.ok(b.labels().includes('Two rabbit pelts, open'));
});
