// Breaks: a page arriving by a turn no longer takes focus, so a screen reader stays on the last
// page. (Launch takes none: the Room page story's play, BOOK-UI-COMPONENTS.md Focus.)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { book } from './__tests__/polish-book.test.ts';

// Mounts each shown title: how many take focus.
const focused = (h: ReturnType<typeof book>) => {
  let n = 0;
  for (const t of h.draw().filter((e) => e.type === 'Text' && e.props.tabIndex === -1))
    t.props.ref({ focus: () => n++ });
  return n;
};

test('a page title arriving by a turn takes focus', () => {
  const h = book(); // the harness has turned from the chapter page to the room
  assert.equal(focused(h), 1);
  h.tap('Old Bram is here., open');
  assert.equal(focused(h), 1);
});
