// Real book components and session; native hosts are leaves, so this is no device/layout proof.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { darkMarshBundle } from '../../authority/local-story/__tests__/priory-fixture.ts';
import type { GameSubscription } from '../../packages/game-view/session.ts';
import { CONTENTS } from './__tests__/control.test.ts';
import { book, bundle, fixture, nodes, words } from './__tests__/polish-book.test.ts';

// Breaks: an unconfirmed Take leaves the detail or announces success; retry loses its original
// target name or leaves Map open; a queued stale Take reopens its obsolete detail.
test('only confirmed pickup returns World, including a retry from another page', () => {
  const h = book();
  h.map();
  h.tap('Go north');
  h.tap('A brass lantern');
  assert.deepEqual(
    h.labels().filter((s) => !CONTENTS.test(s)),
    ['Take a brass lantern', 'Leave'],
  );
  const drawnTake = h.draw().find((n) => n.props.accessibilityLabel === 'Take a brass lantern');
  h.sql.exec('PRAGMA query_only = 1');
  h.tap('Take a brass lantern');
  assert.equal(h.game.pending(), true);
  assert.ok(h.labels().includes('Leave'));
  assert.deepEqual(h.game.view().view.inventory, []);
  assert.equal(
    h.p.screen().log.some((s: string) => s === 'You pick up a brass lantern.'),
    false,
  );
  assert.match(h.p.screen().fault!, /readonly/);
  h.tap('Leave');
  h.sql.exec('PRAGMA query_only = 0');
  h.map();
  h.tap('Go south'); // retries Take; the player remains at Well Lane
  assert.equal(h.game.view().view.place.title.key, 'room.well_lane.title');
  assert.ok(h.text().includes('Well Lane'));
  assert.equal(h.labels().includes('Take a brass lantern'), false);
  assert.equal(h.p.screen().log.at(-1), 'You pick up a brass lantern.');
  h.draw();
  assert.equal(h.p.screen().log.at(-1), 'You pick up a brass lantern.');
  drawnTake.props.onPress();
  assert.ok(h.labels().includes('Position, standing'));
  assert.equal(h.labels().includes('Leave'), false);
  assert.equal(
    h.p.screen().log.filter((s: string) => s === 'You pick up a brass lantern.').length,
    1,
  );
  h.tap(CONTENTS);
  h.tap('Equipment & Inventory');
  assert.ok(h.text().includes('Held'));
  h.tap('a brass lantern, open');
  const token = h.game.view().token;
  h.tap('Leave');
  assert.equal(h.game.view().token, token);
  assert.ok(h.text().includes('Well Lane'));
  h.sql.close();
});

// Breaks: the item-only Give returns, or the guard rejects a complete Give with a real recipient.
test('touch omits incomplete Give but the complete item and recipient command remains valid', () => {
  const h = book();
  h.map();
  h.tap('Go north');
  h.tap('A brass lantern');
  h.tap('Take a brass lantern');
  const item = h.game.view().view.inventory[0];
  assert.equal(item.actions.find((a) => a.action_key === 'give')?.available, true);
  assert.equal(
    h.p.screen().buttons.some((b) => b.action_key === 'give'),
    false,
  );
  const token = h.game.view().token;
  const receipts = () => h.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n;
  const before = receipts();
  h.p.press({ label: 'Give', action_key: 'give', target_ids: [item.id], input: {}, token });
  assert.equal(h.game.view().token, token);
  assert.equal(receipts(), before);
  h.map();
  h.tap('Go south');
  const npc = h.game.view().view.entities.find((e) => e.kind === 'npc')!;
  h.p.press({
    label: 'Give',
    action_key: 'give',
    target_ids: [item.id, npc.id],
    input: {},
    token: h.game.view().token,
  });
  assert.deepEqual(h.game.view().view.inventory, []);
  assert.notEqual(h.game.view().token, token);
  h.sql.close();
});

// Breaks: inventory Drop stays in detail, falsely succeeds while pending, or retry loses its name.
test('inventory Drop returns World with one named event only after confirmation', () => {
  const h = book();
  h.map();
  h.tap('Go north');
  h.tap('A brass lantern');
  h.tap('Take a brass lantern');
  h.tap(CONTENTS);
  h.tap('Equipment & Inventory');
  h.tap('a brass lantern, open');
  assert.deepEqual(h.text().slice(0, 2), [
    'A brass lantern',
    'Dented brass with a horn window, oil sloshing inside.',
  ]);
  assert.equal(h.labels().includes('Take a brass lantern'), false);
  h.sql.exec('PRAGMA query_only = 1');
  h.tap('Drop a brass lantern');
  assert.equal(h.game.pending(), true);
  assert.equal(h.game.view().view.inventory.length, 1);
  assert.ok(h.labels().includes('Leave'));
  assert.equal(
    h.p.screen().log.some((s: string) => s === 'You drop a brass lantern.'),
    false,
  );
  h.tap('Leave');
  h.sql.exec('PRAGMA query_only = 0');
  h.map();
  h.tap('Go south'); // retries Drop without walking
  assert.deepEqual(h.game.view().view.inventory, []);
  assert.ok(h.labels().includes('A brass lantern is here., open'));
  assert.ok(h.labels().includes('Position, standing'));
  assert.equal(h.labels().includes('Leave'), false);
  assert.equal(h.p.screen().log.at(-1), 'You drop a brass lantern.');
  h.draw();
  assert.equal(h.p.screen().log.filter((s: string) => s === 'You drop a brass lantern.').length, 1);
  h.sql.close();
});

// Breaks: a retained container result is hidden or leaks into World instead of its item detail.
test('other item actions retain their detail and show their consequences there', () => {
  const items = JSON.parse(
    readFileSync(
      new URL('../../../protocol/fixtures/containers_cartridge_locks_hash.json', import.meta.url),
      'utf8',
    ),
  );
  const h = book(items);
  h.tap('A sewing box');
  h.tap('Open a sewing box');
  assert.ok(h.labels().includes('Leave'));
  assert.ok(h.labels().includes('Close a sewing box'));
  assert.ok(h.text().includes('Opened.'));
  assert.equal(h.p.screen().log.includes('Opened.'), false);
  h.tap('Leave');
  assert.ok(h.labels().includes('A sewing box is here., open'));
  h.sql.close();
});

// Breaks: a confirmed boundary is ignored/coalesced, resets the chapter acknowledgment,
// flips a same-room page, or removes a departed speaker's actual continuation/history.
test('elapsed confirmed boundaries retain Conversation and chapter acknowledgment without page flips', () => {
  const h = book(bundle('containers_sampler_v010_hash'));
  try {
    h.tap('Old Bram');
    h.tap('Talk to Old Bram');
    const speaker = h.game.view().view.choice!.speaker_id!;
    const before = [...h.p.screen().detail(speaker)];
    const turn = () => h.draw().find((n) => n.type.name === 'PageTurn').props.turn;
    const opened = turn();
    h.clock.wall = 82000;
    h.clock.mono = 72000;
    assert.equal(h.game.pulse().kind, 'ready');
    assert.equal(h.game.view().view.time, 68400);
    assert.ok(h.text().includes('Conversation'));
    assert.ok(h.labels().includes('Leave'));
    assert.ok(h.text().includes('They are not here to answer. Find them, or close this.'));
    assert.deepEqual(h.p.screen().detail(speaker), before);
    assert.deepEqual(h.p.screen().log, ['Old Bram leaves.']);
    assert.equal(turn(), opened);
    // Consecutive committed boundaries in one host pulse must each be consumed, despite batching.
    h.clock.wall = 1810000;
    h.clock.mono = 1800000;
    assert.equal(h.game.pulse().kind, 'ready');
    assert.deepEqual(h.p.screen().log, [
      'Old Bram leaves.',
      'Old Bram arrives.',
      'Old Bram leaves.',
    ]);
    assert.equal(turn(), opened);
    h.tap('Leave');
    assert.equal(h.game.view().view.choice, undefined);
    assert.ok(h.text().includes('Ferry Landing'));
    assert.equal(
      h.p.screen().log.filter((s: string) => s.includes('leave the question')).length,
      0,
    );
    const worldTurn = turn();
    h.clock.wall = 2602000;
    h.clock.mono = 2592000;
    assert.equal(h.game.pulse().kind, 'ready');
    assert.equal(h.game.view().view.time, 194400);
    assert.ok(h.labels().includes('Old Bram is here., open'));
    assert.equal(turn(), worldTurn);
  } finally {
    h.unmount();
    h.sql.close();
  }
});

// Breaks: B's conflict drops delayed A's item context, or terminal replay duplicates its pickup.
test('delayed Take returns once with its original item name after a conflicting tap', () => {
  const a = elapsedHost(),
    h = book(fixture, a),
    completed: GameSubscription[] = [];
  h.game.subscribe((u) => {
    if (u.kind === 'completion') completed.push(u);
  });
  try {
    h.tap('A brass lantern');
    h.clock.wall += 15984000;
    h.clock.mono = 15984000;
    h.tap('Take a brass lantern');
    const id = h.game.pendingInvocation();
    assert.ok(id);
    assert.equal(h.p.screen().pending, false);
    assert.ok(h.text().includes('Catching up…'));
    assert.ok(h.labels().includes('Leave'));
    const different = { label: 'Rest', action_key: 'rest', target_ids: [], input: {} };
    h.p.press(different);
    assert.equal(h.game.pendingInvocation(), id);
    const refused = h.game.invoke({ action_key: 'rest' as never, target_ids: [], input: {} });
    assert.equal(refused.kind, 'conflict');
    assert.equal(
      h.p.update({
        kind: 'completion',
        invocation_id: 'another-action',
        intent: { action_key: 'rest' as never, target_ids: [], input: {} },
        before: h.game.view(),
        reply: refused,
      }),
      false,
    );
    assert.equal(h.game.pendingInvocation(), id);
    assert.equal(h.game.pulse().kind, 'ready');
    assert.ok(h.text().includes('Ferry Landing'));
    assert.equal(
      h.p.screen().log.filter((s: string) => s === 'You pick up a brass lantern.').length,
      1,
    );
    assert.equal(h.p.screen().log.includes('Taken.'), false);
    assert.equal(h.p.update(completed[0]), false);
    assert.equal(
      h.p.screen().log.filter((s: string) => s === 'You pick up a brass lantern.').length,
      1,
    );
    h.tap(CONTENTS);
    h.tap('Equipment & Inventory');
    h.tap('a brass lantern, open');
    const turn = h.draw().find((n) => n.type.name === 'PageTurn').props.turn;
    h.clock.wall += 20;
    h.clock.mono += 20;
    h.game.pulse();
    assert.ok(h.labels().includes('Drop a brass lantern'));
    assert.equal(h.draw().find((n) => n.type.name === 'PageTurn').props.turn, turn);
  } finally {
    h.unmount();
    h.sql.close();
  }
});

// Breaks: delayed quest completion loses original NPC history or repeats the neutral journal event.
test('delayed actual quest completion adds one authored result and Journal updated in original history', () => {
  const h = book(bundle('containers_sampler_v010_hash')),
    completed: GameSubscription[] = [];
  h.game.subscribe((u) => {
    if (u.kind === 'completion') completed.push(u);
  });
  try {
    h.tap('Old Bram');
    h.tap('Talk to Old Bram');
    const speaker = h.game.view().view.choice!.speaker_id!;
    h.clock.wall += 15552000;
    h.clock.mono = 15552000;
    h.tap("Offer to fetch Bram's lantern");
    assert.equal(h.game.pending(), true);
    assert.equal(h.game.pulse().kind, 'ready');
    assert.equal(h.game.view().view.time, 842400);
    assert.equal(h.game.view().view.journal[0].state, 'active');
    const history = h.p.screen().detail(speaker);
    assert.equal(
      history.filter(
        (s: unknown) => s === "You say you'll fetch it. Bram nods toward the path north.",
      ).length,
      1,
    );
    assert.deepEqual(
      history.filter((s: unknown) => typeof s !== 'string'),
      [{ text: 'Journal updated', event: true }],
    );
    assert.equal(h.p.update(completed[0]), false);
    assert.equal(history.filter((s: unknown) => typeof s !== 'string').length, 1);
  } finally {
    h.unmount();
    h.sql.close();
  }
});

// Breaks: available-only buttons hide the carrying reason, or shedding worn load leaves a stale note.
test('actual trunk detail explains refused Take and restores its button after Remove then Drop', () => {
  const h = book();
  const go = (direction: string) => {
    h.map();
    h.tap(`Go ${direction}`);
  };
  const take = (name: string) => {
    h.tap(`${name[0].toUpperCase()}${name.slice(1)} is here.`);
    h.tap(`Take ${name}`);
  };
  go('north');
  take('a brass lantern');
  go('east');
  go('up');
  take('a brass key');
  take('a wool cloak');
  const carrying = () => {
    h.tap(CONTENTS);
    h.tap('Equipment & Inventory');
  };
  carrying();
  h.tap('a wool cloak, open');
  h.tap('Wear a wool cloak');
  h.tap('Leave');
  go('up');
  h.tap('An old trunk');
  assert.ok(h.text().includes('Take: too heavy to carry.'));
  assert.equal(h.labels().includes('Take an old trunk'), false);
  h.tap('Leave');
  carrying();
  h.tap('a wool cloak, open');
  h.tap('Remove a wool cloak');
  assert.equal(h.labels().includes('Drop a wool cloak'), true);
  h.tap('Drop a wool cloak');
  h.tap('An old trunk');
  assert.equal(
    h.text().some((s) => s.includes('too heavy to carry')),
    false,
  );
  assert.ok(h.labels().includes('Take an old trunk'));
  h.tap('Take an old trunk');
  assert.ok(h.game.view().view.inventory.some((e) => e.name === 'item.trunk.short'));
  h.unmount();
  h.sql.close();
});

// Break: a targetless recipe exists only in a self-luminous Notice, so the World detail has no control.
test('self-luminous Notice invokes its projected targetless recipe and retains the result', () => {
  const h = book(darkMarshBundle());
  try {
    assert.ok(h.labels().includes('Marsh glow, open'));
    h.tap('Marsh glow');
    assert.ok(h.text().includes('You follow the glow and find a wisp waiting above the reeds.'));
    assert.equal(
      h.p.screen().log.includes('You follow the glow and find a wisp waiting above the reeds.'),
      false,
    );
    assert.ok(h.labels().includes('Leave'));
  } finally {
    h.unmount();
    h.sql.close();
  }
});

// Breaks: a readable whose read text is its own description (Chapter 1's well) shows that
// sentence twice on its page, or a different read line is dropped with it.
test('a notice page shows its description once and every other read line', async () => {
  const { NoticePage } = await import('./notices.tsx');
  const well = 'A rope and bucket hang over clear, cold well water.';
  const shown = nodes(
    NoticePage({
      screen: {
        view: { notices: [{ id: 'well', title: 'The well', description: well }] },
        text: (key: string) => key,
        detail: () => [well, 'You read it twice.'],
      },
      page: { kind: 'notice', id: 'well' },
      open: () => {},
      press: () => {},
      world: () => {},
    } as any),
  )
    .filter((n) => n.type === 'Text')
    .map(words);
  assert.deepEqual(shown, ['The well', well, 'You read it twice.', 'Leave']);
});

// Breaks: the running head is missing on the room or NPC page after a quest is accepted, or shows
// before any quest is active, or repeats on the Journal page (BOOK-UI-COMPONENTS.md, Page).
test('the running head shows the active quest objective on room and NPC pages', () => {
  const head = 'Look for a sign of Wren on Village Green.'; // quest.first_lead.active
  const h = book(bundle('missing_child_v042_hash'));
  h.tap('Fen-born');
  if (h.labels().includes('Continue')) h.tap('Continue');
  assert.equal(h.text().includes(head), false);
  h.tap('Elspeth');
  h.tap('Talk to Elspeth');
  h.tap('Will you look around the Green for a sign of Wren?');
  assert.ok(h.text().includes(head));
  h.tap('Leave');
  assert.ok(h.text().includes('Ferry Landing'));
  assert.ok(h.text().includes(head));
  h.tap(CONTENTS);
  h.tap('Journal');
  assert.equal(h.text().filter((t) => t === head).length, 1); // the entry, not a head as well
  h.sql.close();
});
