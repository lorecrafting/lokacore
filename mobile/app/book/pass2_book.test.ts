// Pass-2 Book rows on the showcase (re-walk of pass 1; R1's spell chip is pinned in word_bar.test.ts):
// a learned teach line asks nothing more (H3), an NPC page with price rows draws no empty Note
// (UH3 on NPC pages), and a resting rod notes its use (R2).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { openGame } from '../../authority/local-story/session.ts';
import { book } from './__tests__/polish-book.test.ts';
import { LABEL } from './labels.ts';

const showcase = () => book(compiled('cartridges/toolbox_showcase') as never);
const go = (b: ReturnType<typeof showcase>, ...ds: string[]) =>
  ds.forEach((d) => (b.map(), b.tap(`Go ${d}`)));

// Breaks: a teach line dumps its fields, a qualified one repeats how to learn it (H3), or an
// unqualified or locked one stops naming its requirement (loka-x6t.24).
test('a learned teach line drops its requirement', (t) => {
  const b = showcase();
  t.after(() => b.sql.close());
  go(b, 'north', 'west', 'west');
  b.tap('The carpenter is here.');
  b.tap('Talk to the carpenter');
  b.tap('Learn whittling');
  const shown = b.text();
  assert.ok(shown.includes('Whittling: learned.'), JSON.stringify(shown));
  assert.ok(shown.includes('The carpenter teaches Woodcutting.'), JSON.stringify(shown));
  // the same page with every skill unqualified, then woodcutting locked (controlled views): the
  // requirement comes back (book-ui.md, Skill tree details; loka-x6t.24)
  const real = b.game.view.bind(b.game);
  const skills = (f: (s: { acquired: boolean }) => object) => {
    b.game.view = () => {
      const r = real();
      return {
        ...r,
        view: { ...r.view, skills: r.view.skills?.map((s) => ({ ...s, ...f(s) })) },
      } as never;
    };
    return b.text();
  };
  const free = 'The carpenter teaches it free.';
  const unqualified = skills(() => ({ qualified: false }));
  assert.ok(
    unqualified.includes(`Whittling: learned, unqualified; ${free}`),
    JSON.stringify(unqualified),
  );
  assert.ok(unqualified.includes(`The carpenter teaches Woodcutting; ${free}`));
  const locked = skills((s) => ({ locked: !s.acquired }));
  assert.ok(locked.includes(`Woodcutting: locked; ${free}`), JSON.stringify(locked));
});

// Breaks: reopening the save seeds the NPC page with the last visit's narration, so a fresh
// visit opens on an old talk line (loka-x6t.19).
test('a fresh NPC visit after a reopen starts empty', () => {
  const cart = compiled('cartridges/toolbox_showcase') as never;
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, cart);
  const b = book(cart, a);
  go(b, 'north', 'west', 'west');
  b.tap('The carpenter is here.');
  b.tap('Talk to the carpenter');
  b.tap('Learn whittling');
  const taught = b.text().find((x) => x.startsWith('The carpenter shows you'));
  assert.ok(taught, JSON.stringify(b.text()));
  b.tap(LABEL.leaveConversation);
  b.unmount();
  const r = book(cart, { ...a, game: openGame(a.db, cart, a.host) });
  r.tap('The carpenter is here.');
  assert.equal(r.text().includes(taught), false, JSON.stringify(r.text()));
  r.unmount();
  a.sql.close();
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

// Breaks: the rod's page drops its use once the rod rests between casts (R2), so the player
// cannot tell the rod still fishes, or another target of the use refused for an unnoted reason
// hides the note (loka-x6t.80).
test('a resting rod keeps its use as a note', (t) => {
  const b = showcase();
  t.after(() => b.sql.close());
  go(b, 'north', 'west', 'south', 'east');
  b.tap('A fishing rod is here.');
  b.tap('Take a fishing rod');
  const rod = () => (b.tap(/opens Contents$/), b.tap(LABEL.inventory), b.tap('a fishing rod'));
  rod();
  b.tap('Fish in');
  rod();
  const shown = b.text();
  assert.ok(shown.includes('Fish in: not yet.'), JSON.stringify(shown));
  // two targets of one resting use (controlled view): one note, not two under one key
  const real = b.game.view.bind(b.game);
  b.game.view = () => {
    const r = real();
    const inventory = r.view.inventory.map((e) => ({
      ...e,
      actions: e.actions.flatMap((a) => (a.reason?.code === 'cooldown' ? [a, a] : [a])),
    }));
    return { ...r, view: { ...r.view, inventory } } as never;
  };
  assert.equal(
    b.text().filter((l) => l === 'Fish in: not yet.').length,
    1,
    JSON.stringify(b.text()),
  );
  // the use's first target is refused for an unnoted reason: the resting target still draws
  // its note, so the dedupe runs over drawn notes only (loka-x6t.80)
  b.game.view = () => {
    const r = real();
    const inventory = r.view.inventory.map((e) => ({
      ...e,
      actions: e.actions.flatMap((a) =>
        a.reason?.code === 'cooldown' ? [{ ...a, reason: { code: 'invalid_state' } }, a] : [a],
      ),
    }));
    return { ...r, view: { ...r.view, inventory } } as never;
  };
  assert.ok(b.text().includes('Fish in: not yet.'), JSON.stringify(b.text()));
});
