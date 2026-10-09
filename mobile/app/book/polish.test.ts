// Real book components and session; native hosts are leaves, so this is no device/layout proof.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openGame } from '../../authority/local-story/session.ts';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { book, bundle, nodes, words } from './__tests__/polish-book.test.ts';

// Breaks: confirmed pelt Take returns to World, leaves the stale pelt child open, or restores
// its pickup on the World log instead of the exact corpse after reopening.
test('corpse Contents Take returns to its detail with one local pickup and Back to World', () => {
  const chapter = bundle('missing_child_v030_hash');
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, chapter);
  const invoke = (action_key: string, target_ids: string[] = [], input = {}) => {
    const reply = a.game.invoke({ action_key, target_ids, input } as never);
    assert.equal(reply.kind, 'saved');
    if (reply.kind === 'saved') assert.equal(reply.decision.kind, 'accepted');
  };
  for (const direction of ['south', 'south', 'east']) invoke('move', [], { direction });
  const member = a.game.view().view.entities.find((e) => e.name === 'npc.fen_hound.short')!;
  invoke('attack', [member.id]);
  let corpse = a.game.view().view.entities.find((e) => e.name === 'item.hound_corpse.short');
  for (let i = 0; i < 20 && !corpse; i++) {
    a.clock.wall += 3000;
    a.clock.mono += 3000;
    assert.equal(a.game.pulse().kind, 'ready');
    corpse = a.game.view().view.entities.find((e) => e.name === 'item.hound_corpse.short');
  }
  assert.ok(corpse);
  const pelt = corpse.contents!.find((e) => e.name === 'item.hound_pelt.short')!;
  const h = book(chapter, a);
  h.tap(h.labels().find((x) => x.includes('hound corpse') && x.includes('open'))!);
  h.tap(h.labels().find((x) => x.includes('hound pelt') && x.includes('open'))!);
  assert.deepEqual(
    h.stack.map((p: any) => p.id),
    [corpse.id, pelt.id],
  );
  h.tap('Back to container');
  assert.deepEqual(
    h.stack.map((p: any) => p.id),
    [corpse.id],
  );
  h.tap(h.labels().find((x) => x.includes('hound pelt') && x.includes('open'))!);
  assert.ok(
    h.labels().some((x) => x.startsWith('Take')),
    JSON.stringify(h.labels()),
  );
  a.fault.kind = 'lost';
  a.fault.armed = true;
  h.tap(h.labels().find((x) => x.startsWith('Take'))!);
  assert.equal(h.game.pending(), true);
  assert.deepEqual(
    h.stack.map((p: any) => p.id),
    [corpse.id, pelt.id],
  );
  assert.equal(h.p.screen().detail(corpse.id).length, 0);
  a.fault.reads = false;
  h.tap(h.labels().find((x) => x.startsWith('Take'))!);
  assert.equal(h.game.pending(), false);
  assert.deepEqual(
    h.stack.map((p: any) => p.id),
    [corpse.id],
  );
  assert.equal(
    h.p
      .screen()
      .detail(corpse.id)
      .filter((x: string) => x === 'You pick up a hound pelt.').length,
    1,
  );
  assert.equal(h.p.screen().log.includes('You pick up a hound pelt.'), false);
  assert.ok(h.game.view().view.inventory.some((e) => e.id === pelt.id));
  const refused = h.game.invoke({ action_key: 'take', target_ids: [pelt.id], input: {} } as never);
  assert.equal(refused.kind, 'saved');
  if (refused.kind === 'saved') assert.equal(refused.decision.kind, 'rejected');
  assert.equal(
    h.p
      .screen()
      .detail(corpse.id)
      .filter((x: string) => x === 'You pick up a hound pelt.').length,
    1,
  );
  h.tap('Leave');
  assert.deepEqual(h.stack, []);
  const drop = h.game.invoke({ action_key: 'drop', target_ids: [pelt.id], input: {} } as never);
  assert.equal(drop.kind, 'saved');
  if (drop.kind === 'saved') assert.equal(drop.decision.kind, 'accepted');
  h.unmount();
  const reopened = book(chapter, { ...a, game: openGame(a.db, chapter, a.host) });
  assert.equal(reopened.p.screen().log.includes('You pick up a hound pelt.'), false);
  reopened.tap(reopened.labels().find((x) => x.includes('hound corpse') && x.includes('open'))!);
  assert.equal(
    reopened.p
      .screen()
      .detail(corpse.id)
      .filter((x: string) => x === 'You pick up a hound pelt.').length,
    1,
  );
  reopened.unmount();
  a.sql.close();
});

// Breaks: a lost Take acknowledgement settles after Book remount and sends the confirmed corpse
// pickup to World because the new presenter has no press context.
test('remounted pending pelt Take settles on its exact corpse detail', () => {
  const chapter = bundle('missing_child_v030_hash');
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, chapter);
  const invoke = (action_key: string, target_ids: string[] = [], input = {}) => {
    const reply = a.game.invoke({ action_key, target_ids, input } as never);
    assert.equal(reply.kind, 'saved');
    if (reply.kind === 'saved') assert.equal(reply.decision.kind, 'accepted');
  };
  for (const direction of ['south', 'south', 'east']) invoke('move', [], { direction });
  const member = a.game.view().view.entities.find((e) => e.name === 'npc.fen_hound.short')!;
  invoke('attack', [member.id]);
  let corpse = a.game.view().view.entities.find((e) => e.name === 'item.hound_corpse.short');
  for (let i = 0; i < 20 && !corpse; i++) {
    a.clock.wall += 3000;
    a.clock.mono += 3000;
    assert.equal(a.game.pulse().kind, 'ready');
    corpse = a.game.view().view.entities.find((e) => e.name === 'item.hound_corpse.short');
  }
  assert.ok(corpse);
  const pelt = corpse.contents!.find((e) => e.name === 'item.hound_pelt.short')!;
  const first = book(chapter, a);
  first.tap(first.labels().find((x) => x.includes('hound corpse') && x.includes('open'))!);
  first.tap(first.labels().find((x) => x.includes('hound pelt') && x.includes('open'))!);
  a.fault.kind = 'lost';
  a.fault.armed = true;
  first.tap(first.labels().find((x) => x.startsWith('Take'))!);
  assert.equal(a.game.pending(), true);
  first.unmount();
  const remounted = book(chapter, a);
  a.fault.reads = false;
  assert.equal(a.game.pulse().kind, 'ready');
  assert.deepEqual(
    remounted.stack.map((p: any) => p.id),
    [corpse.id],
  );
  assert.equal(
    remounted.p
      .screen()
      .detail(corpse.id)
      .filter((x: string) => x === 'You pick up a hound pelt.').length,
    1,
  );
  assert.equal(remounted.p.screen().log.includes('You pick up a hound pelt.'), false);
  assert.ok(a.game.view().view.inventory.some((e) => e.id === pelt.id));
  remounted.tap('Leave');
  assert.deepEqual(remounted.stack, []);
  remounted.unmount();
  a.sql.close();
});

// Breaks: room title scrolls away, room Ways returns, or Back pops to Contents instead of World.
test('room is focused while Map retains directions and every detail returns to the world', () => {
  const h = book();
  const roomScroll = h.draw().find((n) => n.type === 'ScrollView');
  assert.equal(words(roomScroll).includes('Ferry Landing'), false);
  assert.ok(words(roomScroll).includes('Reeds crowd a slick wooden landing'));
  assert.ok(nodes(roomScroll).some((n) => n.props.accessibilityLabel === 'Old Bram, open'));
  assert.ok(h.text().includes('Ferry Landing'));
  const drawnLook = h.draw().find((n) => n.props.accessibilityLabel === 'Look, Ferry Landing');
  assert.ok(drawnLook);
  const receipts = () => h.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n;
  assert.equal(receipts(), 0);
  const token = h.game.view().token;
  h.tap('Look, Ferry Landing');
  assert.equal(receipts(), 1);
  assert.notEqual(h.game.view().token, token);
  assert.equal(h.game.view().view.place.title.key, 'room.ferry_landing.title');
  assert.deepEqual(h.p.screen().log, []);
  drawnLook.props.onPress(); // this captured title has the pre-Look freshness token
  assert.equal(receipts(), 1);
  assert.deepEqual(h.p.screen().log, ['The page had changed; here it is again.']);
  assert.ok(h.labels().includes('Old Bram, open'));
  assert.equal(h.text().includes('North'), false);
  assert.equal(h.text().includes('Beyond north: Well Lane — a brass lantern.'), false);
  h.map();
  assert.ok(h.labels().includes('Go north'));
  assert.ok(h.text().includes('Beyond north: Well Lane — a brass lantern.'));
  h.tap('Back to World');
  h.tap(h.labels().find((s) => s.startsWith('Contents,'))!);
  h.tap('Equipment & Inventory');
  h.tap('Back to World');
  assert.ok(h.labels().includes('Old Bram, open'));
  assert.equal(h.labels().includes('Equipment & Inventory'), false);
  const sections = ['Character', 'Equipment & Inventory', 'Map', 'Journal', 'Settings'];
  for (const section of sections) {
    h.tap(h.labels().find((label) => label.startsWith('Contents,'))!);
    assert.deepEqual(
      h.labels().filter((label) => sections.includes(label)),
      sections,
    );
    assert.ok(h.text().includes('Contents'));
    h.tap(section);
    assert.ok(h.text().includes(section));
    assert.deepEqual(
      h.labels().filter((label) => sections.includes(label)),
      [],
    );
    h.tap('Back to World');
    assert.ok(h.labels().includes('Old Bram, open'));
  }
  h.sql.close();
});

// Breaks: a recovery read after commit escapes the press, hiding the result and retaining retry
// context, or its reason sits inside the Start over button where its label hides it.
test('a postcommit narration read fault preserves the saved result and clears retry context', () => {
  const h = book();
  h.tap('Old Bram, open');
  h.tap('Talk to Old Bram');
  const speaker = h.game.view().view.choice!.speaker_id!;
  const result = "You say you'll fetch it. Bram nods toward the path north.";
  h.failNarration(); // Only narration recovery after an actual newly committed revision faults.
  assert.doesNotThrow(() => h.tap("Offer to fetch Bram's lantern"));
  assert.equal(h.game.pending(), false);
  assert.equal(h.game.view().view.journal[0].state, 'active');
  assert.deepEqual(h.p.screen().detail(speaker).slice(-2), [
    result,
    { text: 'Journal updated', event: true },
  ]);
  const fault = 'Saved result; narration recovery unavailable: no such table: missing_narration';
  assert.ok(h.text().includes(fault));
  // A screen reader hears the reason too, not only the Start over button's label.
  const startOver = h.draw().find((n) => n.props?.accessibilityLabel === 'Start over');
  assert.ok(startOver && !words(startOver).includes(fault));
  h.tap('Leave');
  h.map();
  h.tap('Go north'); // a fresh move, not a replay of the committed choice
  assert.ok(h.text().includes('Well Lane'));
  assert.equal(
    h.p
      .screen()
      .detail(speaker)
      .filter((s: string) => s === result).length,
    1,
  );
  assert.equal(h.p.screen().fault, undefined);
  assert.deepEqual(h.p.screen().log, []);
  h.tap('a brass lantern, open');
  h.tap('Take a brass lantern');
  assert.deepEqual(h.p.screen().log, ['You pick up a brass lantern.']);
  h.sql.close();
});

// Breaks: Leave is redundant or closes optimistically, journal cues look like speech, or controls leave the log.
test('NPC history has distinct journal events and one confirmed Leave after the scrolling log', () => {
  const h = book();
  h.tap('Old Bram, open');
  const turn = () => h.draw().find((n) => n.type.name === 'PageTurn').props.turn;
  const entered = turn();
  assert.deepEqual(h.text().slice(0, 2), [
    'Old Bram',
    'A ferryman with rope-scarred hands and a coat that has never been dry.',
  ]);
  h.tap('Talk to Old Bram');
  assert.equal(turn(), entered);
  const speaker = h.game.view().view.choice!.speaker_id!;
  const prompt =
    'Bram keeps his eyes on the reeds. "My lantern’s beside the well, and I can’t leave the ferry. Would you fetch it?"';
  assert.deepEqual(h.p.screen().detail(speaker), [prompt]);
  const scroll = h.draw().find((n) => n.type === 'ScrollView');
  const controls = nodes(scroll);
  assert.ok(
    controls.findIndex((n) => words(n) === prompt) <
      controls.findIndex((n) => n.type === 'Pressable'),
  );
  assert.deepEqual(
    controls.filter((n) => n.type === 'Pressable').map((n) => n.props.accessibilityLabel),
    ["Offer to fetch Bram's lantern", 'Leave'],
  );
  h.tap('Leave');
  assert.equal(h.game.view().view.choice, undefined);
  h.tap('Old Bram, open');
  h.tap('Talk to Old Bram');
  h.tap(h.labels().find((s) => s.startsWith('Contents,'))!);
  h.tap('Map');
  h.tap('Go north'); // local section navigation preserves the pending choice
  h.tap('Continue conversation');
  h.tap('Leave'); // actual offered Close works without a projected speaker
  assert.equal(h.game.view().view.choice, undefined);
  h.map();
  h.tap('Go south');
  h.tap('Old Bram, open');
  h.tap('Talk to Old Bram');
  const beforeResult = turn();
  h.tap("Offer to fetch Bram's lantern");
  assert.equal(turn(), beforeResult);
  assert.deepEqual(h.p.screen().detail(speaker), [
    prompt,
    prompt,
    prompt,
    "You say you'll fetch it. Bram nods toward the path north.",
    { text: 'Journal updated', event: true },
  ]);
  const flow = nodes(h.draw().find((n) => n.type === 'ScrollView'));
  assert.deepEqual(h.text().slice(0, 3), [
    "Find Bram's lantern.", // the running head: the accepted quest's journal text
    'Old Bram',
    'A ferryman with rope-scarred hands and a coat that has never been dry.',
  ]);
  const cue = flow.findIndex((n) => n.type === 'Text' && words(n) === 'Journal updated');
  assert.equal(flow[cue].props.style.fontStyle, 'italic');
  assert.ok(cue < flow.findIndex((n) => n.type === 'Pressable'));
  h.tap('Leave');
  assert.equal(h.text().includes('Journal updated'), false);
  h.map();
  h.tap('Go north');
  h.tap('a brass lantern, open');
  const drawnTake = h.draw().find((n) => n.props.accessibilityLabel === 'Take a brass lantern');
  h.clock.wall += 250;
  h.clock.mono += 250;
  assert.equal(h.game.pulse().kind, 'ready');
  drawnTake.props.onPress(); // Breaks: the old-token shortcut keeps an item page after confirmed pickup.
  h.map();
  h.tap('Go south');
  h.tap('Old Bram, open');
  h.tap('Talk to Old Bram');
  h.tap('Keep the lantern');
  assert.equal(h.game.view().view.scene!.index, 1);
  assert.deepEqual(h.labels(), ['Continue']);
  h.sql.close();
});

// Breaks: direct cycling opens a page, flips World, skips a legal state or reuses a new freshness token.
test('only World position taps directly cycle the offered states with captured freshness', () => {
  const h = book();
  const turn = h.draw().find((n) => n.type.name === 'PageTurn').props.turn;
  const drawn = h.draw().find((n) => n.props.accessibilityLabel === 'Position, standing');
  for (const [from, to] of [
    ['standing', 'sitting'],
    ['sitting', 'resting'],
    ['resting', 'sleeping'],
    ['sleeping', 'standing'],
  ]) {
    h.tap(`Position, ${from}`);
    assert.equal(h.game.view().view.position, to);
    assert.equal(h.draw().find((n) => n.type.name === 'PageTurn').props.turn, turn);
    assert.ok(h.labels().includes('Old Bram, open'));
  }
  const token = h.game.view().token;
  drawn.props.onPress();
  assert.equal(h.game.view().token, token);
  assert.equal(h.game.view().view.position, 'standing');
  h.tap(h.labels().find((s) => s.startsWith('Contents,'))!);
  h.tap('Character');
  assert.deepEqual(
    h.labels().filter((s) => ['Stand', 'Sit', 'Rest', 'Sleep'].includes(s)),
    [],
  );
  assert.equal(h.labels().includes('Position, standing'), false);
  h.sql.close();
});

// Breaks: retrying an NPC's unconfirmed choice from Map forgets its original detail context.
test('an NPC choice retried from the world keeps its result in the original detail', () => {
  const h = book();
  h.tap('Old Bram, open');
  h.tap('Talk to Old Bram');
  const bram = h.game.view().view.choice!.speaker_id!;
  h.sql.exec('PRAGMA query_only = 1');
  h.tap("Offer to fetch Bram's lantern");
  assert.equal(h.game.pending(), true);
  h.tap('Leave'); // still unconfirmed, so detail remains
  assert.deepEqual(
    h.p
      .screen()
      .detail(bram)
      .filter((line) => typeof line !== 'string'),
    [],
  );
  h.sql.exec('PRAGMA query_only = 0');
  h.tap(h.labels().find((s) => s.startsWith('Contents,'))!);
  h.tap('Map');
  h.tap('Go north'); // GameSession retries the choice, so no move occurs.
  assert.equal(h.game.pending(), false);
  assert.equal(h.game.view().view.place.title.key, 'room.ferry_landing.title');
  assert.deepEqual(h.p.screen().log, []);
  assert.deepEqual(h.p.screen().detail(bram).slice(-2), [
    "You say you'll fetch it. Bram nods toward the path north.",
    { text: 'Journal updated', event: true },
  ]);
  h.sql.close();
});

// Breaks: a lost ancestry COMMIT acknowledgement hides every choice and the pending line, or a
// later press sends its own choice instead of retrying the original attempt.
test('pending ancestry keeps its choices pressable and a later press retries the original', () => {
  const chapter = bundle('missing_child_v042_hash');
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, chapter);
  const h = book(chapter, a);
  const choices = ['Fen-born', 'Fey-touched', 'Hill-folk', 'Road-born'];
  assert.deepEqual(h.labels(), choices);
  a.fault.kind = 'lost';
  a.fault.armed = true;
  h.tap('Fen-born');
  assert.equal(h.game.pending(), true);
  assert.deepEqual(h.labels(), choices);
  assert.ok(h.text().includes('save not confirmed'));
  a.fault.reads = false;
  h.tap('Road-born');
  assert.equal(h.game.pending(), false);
  assert.equal(h.game.view().view.ancestry_choices, undefined);
  assert.equal(h.game.view().view.ancestry, 'fen_born');
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, 1);
});

// Breaks: NPCs and loose items share one "is here" list, an NPC is listed among the items or
// dropped, or an empty NPC group leaves its own block (book-ui.md, World and status entry).
test('the room lists NPCs first, then every other entity as items, empty groups omitted', async () => {
  const { RoomPage } = await import('./pages.tsx');
  const entity = (id: string, kind: string) => ({ id, kind, name: id });
  const groups = (entities: object[]) =>
    nodes(
      RoomPage({
        view: {
          place: { title: { key: 'Room' }, description: { key: 'A room.' } },
          exits: [],
          entities,
        },
        text: (key: string) => key,
        log: [],
        g: { place: [] },
        press: () => {},
        open: () => {},
        openChoice: () => {},
        details: null,
      } as any),
    )
      .filter(
        (n) =>
          n.type === 'View' && [n.props.children].flat().every((c: any) => c?.type?.name === 'Tap'),
      )
      .map((n) => [n.props.children].flat().map((c: any) => c.props.label));
  const room = [
    entity('satchel', 'item'),
    entity('ash', 'npc'),
    entity('lamp', 'item'),
    entity('wren', 'npc'),
  ];
  assert.deepEqual(groups(room), [
    ['ash, open', 'wren, open'],
    ['satchel, open', 'lamp, open'],
  ]);
  assert.deepEqual(groups([entity('lamp', 'item')]), [['lamp, open']]);
});

// Breaks: a return turns forward or an opened page turns back (BOOK-UI-COMPONENTS.md#page-turn,
// Direction).
test('opening a page turns forward and Back to World turns back', () => {
  const h = book();
  const dir = () => h.draw().find((n) => n.type.name === 'PageTurn').props.dir;
  const contents = () => h.tap(h.labels().find((s) => s.startsWith('Contents,'))!);
  contents();
  h.tap('Back to World');
  assert.equal(dir(), -1);
  contents();
  assert.equal(dir(), 1);
  h.sql.close();
});

// Breaks: the Book ignores the confirmed solar phase, or a component reads a fixed palette instead
// of the one the Book provides. Chapter 1 opens at 18:00, its `dusk` cut.
test('a dusk GameView draws the Book in the dusk palette', () => {
  const h = book(bundle('missing_child_v030_hash'));
  assert.equal(h.game.view().view.calendar_status?.solar, 'dusk');
  const drawn = h.draw();
  assert.equal(drawn.find((n) => n.type === 'SafeAreaView').props.style.backgroundColor, '#2b1e16');
  const title = drawn.find((n) => n.type === 'Text' && n.props.style?.fontSize === 22); // the room title
  assert.equal(title.props.style.color, '#f1ddc2');
});
