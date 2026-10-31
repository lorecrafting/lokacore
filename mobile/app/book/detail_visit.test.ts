// Detail history belongs to the page visit (book-ui.md Detail-page order; loka-x6t.96).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { bundle as goblins, unpacked } from '../../authority/local-story/__tests__/goblins.ts';
import { openGame } from '../../authority/local-story/session.ts';
import { book, bundle } from './__tests__/polish-book.test.ts';
import { LABEL } from './labels.ts';

// Breaks: the sweep drops the question of a choice that opened while its speaker's page was
// closed; the choice card does not draw it, so the reopened page shows only the answers.
test("an open choice's question stays for its speaker's next visit", () => {
  const h = book(bundle('containers_sampler_v010_hash'));
  h.tap('Old Bram');
  h.clock.wall += 15552000; // half a year idle: Talk waits on catch-up
  h.clock.mono = 15552000;
  h.tap('Talk to Old Bram');
  assert.equal(h.game.pending(), true);
  h.draw();
  h.game.pulse();
  h.draw(); // the world page draws with the choice open
  h.tap('Old Bram');
  assert.ok(h.text().some((t) => t.includes('Would you fetch it?')));
  h.unmount();
  h.sql.close();
});

// Breaks: Leave the conversation empties the history while its close is still pending, so a close
// that is never confirmed leaves the open choice without its question; or the confirmed close
// keeps the old conversation on the page (loka-x6t.102).
test("Leave the conversation keeps the choice's question until the close is confirmed", () => {
  const h = book(bundle('containers_sampler_v010_hash'));
  h.tap('Old Bram');
  h.tap('Talk to Old Bram');
  h.clock.wall += 15552000; // half a year idle: the close waits on catch-up
  h.clock.mono = 15552000;
  h.tap(LABEL.leaveConversation);
  assert.equal(h.game.pending(), true);
  assert.ok(h.text().some((t) => t.includes('Would you fetch it?')));
  h.game.pulse();
  assert.equal(
    h.text().some((t) => t.includes('Would you fetch it?')),
    false,
  );
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

// Breaks: a restored corpse pickup line leaves the room log, or draws on the corpse page.
test('a restored pickup stays in the room log after reopen, never on the corpse page', () => {
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
  b.tap('corpse, open');
  b.tap('Look inside');
  b.tap('A goblin ear, open');
  b.tap('Take a goblin ear');
  b.unmount();
  const r = book(cart, { ...a, game: openGame(a.db, cart, a.host) });
  const PICKUP = 'You take a goblin ear.';
  // A corpse take is quiet: the room log keeps it, the corpse page never draws it (Line placement).
  assert.ok(r.text().includes(PICKUP));
  r.tap('corpse, open');
  assert.equal(r.text().includes(PICKUP), false);
  r.unmount();
  a.sql.close();
});

// Breaks: a detail page draws the status line again (its Contents button or compass),
// or an offered action or the status line follows the page's Leave (owner pick mvlrlvappy4w).
test('a detail page has no status line and Leave is its last control', () => {
  const h = book(bundle('containers_sampler_v010_hash'));
  assert.ok(h.labels().some((l) => l.endsWith('opens Contents'))); // World keeps it
  h.tap('Old Bram');
  const labels = h.labels();
  assert.equal(
    labels.some((l) => l.endsWith('opens Contents')),
    false,
  );
  assert.equal(labels.at(-1), LABEL.leave);
  h.sql.close();
});
