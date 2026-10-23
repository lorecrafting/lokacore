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
  b.tap('a seed sack, open');
  assert.ok(b.text().includes('Take: too heavy to carry.'));
});
