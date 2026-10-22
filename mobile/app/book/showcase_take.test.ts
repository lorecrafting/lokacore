// The Homestead seed sack is a heavy fixture: the Book prints its refused Take with the cartridge's own
// label for the action, through the real authority and Book.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';
import { sky } from './model.ts';

// Breaks: the showcase text lacks action.take, so the refusal reads "action.take: too heavy to carry."
test('farm yard: a seed sack that is too heavy reads "Take: too heavy to carry."', () => {
  const b = book(compiled('cartridges/toolbox_showcase') as never);
  for (const d of ['north', 'west', 'south']) {
    b.map();
    b.tap(`Go ${d}`);
  }
  b.tap('A seed sack is here.');
  assert.ok(b.text().includes('Take: too heavy to carry.'));
});

// Breaks: the showcase calendar loses its night cut, so the Book stays light by night and the status
// shows the earthly-branch glyph (docs/system/book-ui.md#world-and-status-entry).
test('showcase at 21:00: night palette and a moon glyph in the status', () => {
  const b = book(compiled('cartridges/toolbox_showcase') as never);
  b.clock.wall += 1_008_000; // 50 logical s per real s: 07:00 start + 14 h
  b.clock.mono += 1_008_000;
  (b.game as unknown as { pulse(): unknown }).pulse();
  const { calendar_status: calendar } = b.game.view().view as {
    calendar_status: { solar?: string; lunar?: string };
  };
  assert.equal(calendar.solar, 'night'); // palette.test.ts pins night -> dark
  assert.equal(sky(calendar.solar, calendar.lunar), '●');
});
