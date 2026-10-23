// The Homestead seed sack is a heavy fixture: the Book prints its refused Take with the cartridge's own
// label for the action, through the real authority and Book.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';

// Breaks: the showcase text lacks action.take, so the refusal reads "action.take: too heavy to carry."
test('farm yard: a seed sack that is too heavy reads "Take: too heavy to carry."', () => {
  const b = book(compiled('cartridges/toolbox_showcase') as never);
  for (const d of ['north', 'west', 'south']) {
    b.map();
    b.tap(`Go ${d}`);
  }
  b.tap('seed sack, open');
  assert.ok(b.text().includes('Take: too heavy to carry.'));
});

// Breaks: the Book collapses by name key (the Glade's pelts are pelt_01..03, one key each), so three
// "rabbit pelt" links show; or a Take leaves the count stale, so the other pelts are unreachable.
test('glade: three pelts are one link "Three rabbit pelts", and after a Take the sentence recounts', () => {
  const b = book(compiled('cartridges/toolbox_showcase') as never);
  for (const d of ['north', 'west', 'south', 'west']) {
    b.map();
    b.tap(`Go ${d}`);
  }
  assert.ok(b.text().includes('Three rabbit pelts are here.'));
  b.tap('Three rabbit pelts, open');
  b.tap(/^Take a rabbit pelt/);
  assert.ok(b.text().includes('Two rabbit pelts are here.'));
  assert.ok(b.labels().includes('Two rabbit pelts, open'));
});
