// Pass-2 Book rows on the showcase (re-walk of pass 1; R1's spell chip is pinned in word_bar.test.ts):
// a learned teach line asks nothing more (H3), and an NPC page with price rows draws no empty Note
// (UH3 on NPC pages).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book } from './__tests__/polish-book.test.ts';

const showcase = () => book(compiled('cartridges/toolbox_showcase') as never);
const go = (b: ReturnType<typeof showcase>, ...ds: string[]) =>
  ds.forEach((d) => (b.map(), b.tap(`Go ${d}`)));

// Breaks: a learned, qualified skill still repeats how to learn it (H3), or an unlearned one stops.
test('a learned teach line drops its requirement', (t) => {
  const b = showcase();
  t.after(() => b.sql.close());
  go(b, 'north', 'west', 'west');
  b.tap('The carpenter is here.');
  b.tap('Talk to the carpenter');
  b.tap('Learn whittling');
  const shown = b.text();
  assert.ok(shown.includes('Whittling: learned; currently qualified.'), JSON.stringify(shown));
  assert.ok(
    shown.includes('Woodcutting: not learned; currently qualified. The carpenter teaches it free.'),
    JSON.stringify(shown),
  );
});

// Breaks: "Nothing to do here." draws above the fence's price rows (UH3), or no longer draws on an
// NPC page with nothing at all.
test('price rows keep the empty Note off an NPC page', (t) => {
  const b = showcase();
  t.after(() => b.sql.close());
  go(b, 'down', 'west');
  b.tap('The fence is here.');
  const shown = b.text();
  assert.ok(
    shown.includes('a beeswax candle: Buy 4p (sold out); Sell 2p (you are not holding it).'),
    JSON.stringify(shown),
  );
  assert.ok(!shown.includes('Nothing to do here.'), JSON.stringify(shown));
  // the same page with the shelf emptied (controlled view): nothing left to read, unless an
  // unavailable service row stands in for it
  const real = b.game.view.bind(b.game);
  const swap = (services?: unknown[]) =>
    (b.game.view = () => {
      const r = real();
      const entities = r.view.entities.map((e) => ({ ...e, shop: undefined, services }));
      return { ...r, view: { ...r.view, entities } } as never;
    });
  swap();
  assert.ok(b.text().includes('Nothing to do here.'), JSON.stringify(b.text()));
  swap([
    {
      service: { key: 'vault' },
      label: 'Rent a vault',
      price: 3,
      benefit: { kind: 'deposit' },
      action: { action_key: 'vault', available: false, reason: { code: 'cooldown' } },
    },
  ]);
  assert.ok(!b.text().includes('Nothing to do here.'), JSON.stringify(b.text()));
});
