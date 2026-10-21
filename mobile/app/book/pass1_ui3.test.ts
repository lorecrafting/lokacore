// Pass-1 UI3 (book-ui.md, World and status entry; Map): the Map draws no log (UF1), a door's state
// line only when no exit card already carries it (UF2), and a shut door's Open also on World (R4).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Game, GameView } from '../../packages/game-view/session.ts';
import { validate } from '../../authority/local-story/__tests__/validate.ts';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { book, nodes, words } from './__tests__/polish-book.test.ts';
import { group } from './model.ts';
import { presenter } from './presenter.ts';

// Breaks: the Map draws the log again (UF1); the door line repeats the exit card's "closed" or
// "locked", or drops while the door is open (UF2); World loses the shut door's Open, draws an open
// door's Close, puts the card after the log, or its press sends another command than the Map's (R4).
test('doors sampler lane: Map and World door lines after closing the hut door', (t) => {
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
  assert.ok(world.indexOf('Open the hut door (north)') < world.indexOf('Closed.'));
  b.tap('Open the hut door (north)');
  b.map();
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

// Breaks: a refused place offer resolves its label with `text` (the raw key) while the offered one
// uses `label` (a readable word), against book-ui.md's one resolver (UI2 review nit).
test('a label key with no text reads the same fallback word offered and refused', async (t) => {
  const { RoomPage } = await import('./pages.tsx');
  const b = book(compiled('cartridges/doors_sampler') as never);
  t.after(() => b.sql.close());
  const offer = {
    action_key: 'fish',
    label: 'action.fish_in',
    target: { kind: 'none' },
    input: [],
  };
  const view = {
    ...b.game.view().view,
    actions: [
      { ...offer, available: true },
      { ...offer, action_key: 'net', available: false, reason: { code: 'cooldown' } },
    ],
  } as GameView;
  assert.deepEqual(validate('GameView', view), []);
  const game = {
    view: () => ({ view, token: 'view:t' }),
    pending: () => false,
    subscribe: () => () => {},
    text: () => undefined,
    lastNarration: () => undefined,
  } as unknown as Game;
  const s = presenter(game).screen();
  const drawn = nodes(
    RoomPage({
      ...s,
      g: group(s.buttons),
      press: () => {},
      open: () => {},
      openChoice: () => {},
      details: null,
    } as never),
  );
  const shown = drawn.filter((n) => n.type === 'Text').map(words);
  assert.ok(shown.includes('Fish in'), JSON.stringify(shown));
  assert.ok(shown.includes('Fish in: not yet'), JSON.stringify(shown));
});
