// The showcase at night: its calendar's solar cuts reach the drawn Book (palette and status sky).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { checkpoints } from '../stories/routes.ts';
import { book } from './__tests__/polish-book.test.ts';
import { color } from './tokens.ts';

// Breaks: the showcase calendar loses its night cut (or the night story stops reaching night), so the
// Book draws the light page at 21:00 and the status shows an earthly-branch glyph, not the moon
// (docs/system/book-ui.md#world-and-status-entry).
test('the showcase night-inn checkpoint draws the dark page and a new moon in the status', () => {
  const b = book(compiled('cartridges/toolbox_showcase') as never);
  for (const step of checkpoints['night-inn']!) (step as (h: typeof b) => void)(b);
  b.draw(); // useShownPalette swaps a changed palette in an effect: the next draw shows it
  const drawn = b.draw();
  assert.equal(
    drawn.find((n) => n.type === 'SafeAreaView').props.style.backgroundColor,
    color.dark.bg,
  );
  assert.ok(b.text().includes('● heat'), b.text().slice(0, 200));
});
