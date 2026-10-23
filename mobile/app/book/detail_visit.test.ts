// Detail history belongs to the page visit (book-ui.md Detail-page order; loka-x6t.96).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { bundle as goblins, unpacked } from '../../authority/local-story/__tests__/goblins.ts';
import { openGame } from '../../authority/local-story/session.ts';
import { book, bundle } from './__tests__/polish-book.test.ts';
import { CONTENTS } from './__tests__/control.test.ts';
import { LABEL } from './labels.ts';

const REPLY = "You say you'll fetch it. Bram nods toward the path north.";

// Breaks: a delayed answer that settles after its page closed writes into the closed page's
// history, and the next visit opens on that old reply (and its Journal updated).
test('a reply that lands after its page closed is not on the next visit', () => {
  const h = book(bundle('containers_sampler_v010_hash'));
  h.tap('Old Bram');
  h.tap('Talk to Old Bram');
  h.clock.wall += 15552000; // half a year idle: the answer waits on catch-up
  h.clock.mono = 15552000;
  h.tap("Offer to fetch Bram's lantern");
  assert.equal(h.game.pending(), true);
  h.tap(CONTENTS);
  h.tap(LABEL.backToWorld);
  h.draw(); // the world page draws before the answer settles
  h.game.pulse();
  h.draw();
  h.tap('Old Bram');
  assert.equal(h.text().includes(REPLY), false);
  assert.equal(h.text().includes('Journal updated'), false);
  h.unmount();
  h.sql.close();
});

// Breaks: after Leave the conversation the page hides a count of lines, which goes stale once the
// 200-line trim drops older ones, so new lines vanish.
test('lines after Leave the conversation survive the history trim', () => {
  const h = book(bundle('containers_sampler_v010_hash'));
  h.tap('Old Bram');
  h.tap('Talk to Old Bram');
  h.tap("Offer to fetch Bram's lantern");
  h.tap(LABEL.leaveConversation);
  const history = h.p.screen().detail(h.stack.at(-1)!.id);
  for (let i = 0; i < 200; i++) history.push(`line ${i}`);
  h.draw();
  assert.ok(h.text().includes('line 0'));
  h.unmount();
  h.sql.close();
});

// Breaks: a restored corpse pickup line stays past the corpse's next visit, or is not on it.
test('a restored pickup shows on the corpse visit after reopen, then only once', () => {
  const cart = goblins(unpacked);
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, cart);
  const invoke = (action_key: string, target_ids: string[] = [], input = {}) =>
    a.game.invoke({ action_key, target_ids, input } as never);
  for (const direction of ['west', 'south']) invoke('move', [], { direction });
  const goblin = a.game.view().view.entities.find((e) => e.name === 'npc.goblin.short')!.id;
  invoke('attack', [goblin]);
  const corpse = () => a.game.view().view.entities.find((e) => e.name === 'item.npc_corpse.short');
  for (let i = 0; i < 20 && !corpse(); i++)
    ((a.clock.wall += 3000), (a.clock.mono += 3000), a.game.pulse());
  const b = book(cart, a);
  b.tap('A corpse');
  b.tap('A goblin ear, open');
  b.tap('Take a goblin ear');
  b.unmount();
  const r = book(cart, { ...a, game: openGame(a.db, cart, a.host) });
  const PICKUP = 'You pick up a goblin ear.';
  assert.equal(r.text().includes(PICKUP), false); // the world, not the corpse, opens
  r.tap('A corpse');
  assert.ok(r.text().includes(PICKUP));
  r.tap(LABEL.leave);
  r.tap('A corpse');
  assert.equal(r.text().includes(PICKUP), false);
  r.unmount();
  a.sql.close();
});
