// A refused action keeps its `label: reason` note on the page that offers it (pass-1 R2;
// book-ui.md Room page anatomy: never on World).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';

// Breaks: the real Book drops the Glade's refused Chop wood (no axe), as before pass-1 R2, or
// says only "not now" without the recipe's authored reason (loka-y6yg.56).
test('glade without an axe: the real Book says why Chop wood is refused', (t) => {
  const b = book(compiled('cartridges/toolbox_showcase') as never);
  t.after(() => b.sql.close());
  for (const d of ['north', 'west', 'south', 'west']) {
    b.map();
    b.tap(`Go ${d}`);
  }
  b.tap('oak, open');
  assert.ok(
    b.text().includes('Chop wood: Needs an axe and woodcutting 1'),
    JSON.stringify(b.text().slice(-8)),
  );
});

// Breaks: the ring's Item page drops its held-on Remove (a cause outside NOTED), loka-x6t.38.
test('a worn cursed ring: its Item page shows "Remove: it will not come off."', (t) => {
  const b = book(compiled('cartridges/curse_sampler') as never);
  t.after(() => b.sql.close());
  b.tap(/silver ring, open$/);
  b.tap(/^Take/);
  b.tap(/opens Contents/);
  b.tap(/^Inventory/);
  b.tap(/silver ring/);
  b.tap(/^Wear/);
  assert.ok(b.text().includes('Remove: it will not come off.'), JSON.stringify(b.text()));
});
