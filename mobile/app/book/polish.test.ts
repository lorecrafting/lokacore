// size: allow 520, the polish picks share one real session and Book renderer harness
// Real book components and session; native hosts are leaves, so this is no device/layout proof.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { openGame } from '../../authority/local-story/session.ts';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { CONTENTS, pressable } from './__tests__/control.test.ts';
import { LABEL } from './labels.ts';
import { bundle as goblins, unpacked } from '../../authority/local-story/__tests__/goblins.ts';
import { book, bundle, nodes, words } from './__tests__/polish-book.test.ts';

// Breaks: confirmed ear Take returns to World, leaves the stale ear child open, or restores
// its pickup on the World log instead of the exact corpse after reopening; or the nested ear
// shows Back to container beside Leave, two returns to the same page (loka-x6t.94).
test('corpse Contents Take returns to its detail with one local pickup and Back to World', () => {
  const chapter = goblins(unpacked);
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, chapter);
  const invoke = (action_key: string, target_ids: string[] = [], input = {}) => {
    const reply = a.game.invoke({ action_key, target_ids, input } as never);
    assert.equal(reply.kind, 'saved');
    if (reply.kind === 'saved') assert.equal(reply.decision.kind, 'accepted');
  };
  for (const direction of ['west', 'south']) invoke('move', [], { direction });
  const member = a.game.view().view.entities.find((e) => e.name === 'npc.goblin.short')!;
  invoke('attack', [member.id]);
  let corpse = a.game.view().view.entities.find((e) => e.name === 'item.npc_corpse.short');
  for (let i = 0; i < 20 && !corpse; i++) {
    a.clock.wall += 3000;
    a.clock.mono += 3000;
    assert.equal(a.game.pulse().kind, 'ready');
    corpse = a.game.view().view.entities.find((e) => e.name === 'item.npc_corpse.short');
  }
  assert.ok(corpse);
  const ear = corpse.contents!.find((e) => e.name === 'item.ear.short')!;
  const h = book(chapter, a);
  h.tap(h.labels().find((x) => x.includes('corpse') && x.includes('open'))!);
  h.tap(h.labels().find((x) => x.includes('goblin ear') && x.includes('open'))!);
  assert.deepEqual(
    h.stack.map((p: any) => p.id),
    [corpse.id, ear.id],
  );
  // Leave already returns to the container, so it is the one return (loka-x6t.94).
  assert.deepEqual(
    h.labels().filter((x) => ['Back to container', 'Leave'].includes(x)),
    ['Leave'],
  );
  h.tap('Leave');
  assert.deepEqual(
    h.stack.map((p: any) => p.id),
    [corpse.id],
  );
  h.tap(h.labels().find((x) => x.includes('goblin ear') && x.includes('open'))!);
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
    [corpse.id, ear.id],
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
      .filter((x: string) => x === 'You pick up a goblin ear.').length,
    1,
  );
  assert.equal(h.p.screen().log.includes('You pick up a goblin ear.'), false);
  assert.ok(h.game.view().view.inventory.some((e) => e.id === ear.id));
  const refused = h.game.invoke({ action_key: 'take', target_ids: [ear.id], input: {} } as never);
  assert.equal(refused.kind, 'saved');
  if (refused.kind === 'saved') assert.equal(refused.decision.kind, 'rejected');
  assert.equal(
    h.p
      .screen()
      .detail(corpse.id)
      .filter((x: string) => x === 'You pick up a goblin ear.').length,
    1,
  );
  h.tap('Leave');
  assert.deepEqual(h.stack, []);
  const drop = h.game.invoke({ action_key: 'drop', target_ids: [ear.id], input: {} } as never);
  assert.equal(drop.kind, 'saved');
  if (drop.kind === 'saved') assert.equal(drop.decision.kind, 'accepted');
  h.unmount();
  const reopened = book(chapter, { ...a, game: openGame(a.db, chapter, a.host) });
  assert.equal(reopened.p.screen().log.includes('You pick up a goblin ear.'), false);
  reopened.tap(reopened.labels().find((x) => x.includes('corpse') && x.includes('open'))!);
  assert.equal(
    reopened.p
      .screen()
      .detail(corpse.id)
      .filter((x: string) => x === 'You pick up a goblin ear.').length,
    1,
  );
  reopened.unmount();
  a.sql.close();
});

// Breaks: a lost Take acknowledgement settles after Book remount and sends the confirmed corpse
// pickup to World because the new presenter has no press context.
test('remounted pending ear Take settles on its exact corpse detail', () => {
  const chapter = goblins(unpacked);
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, chapter);
  const invoke = (action_key: string, target_ids: string[] = [], input = {}) => {
    const reply = a.game.invoke({ action_key, target_ids, input } as never);
    assert.equal(reply.kind, 'saved');
    if (reply.kind === 'saved') assert.equal(reply.decision.kind, 'accepted');
  };
  for (const direction of ['west', 'south']) invoke('move', [], { direction });
  const member = a.game.view().view.entities.find((e) => e.name === 'npc.goblin.short')!;
  invoke('attack', [member.id]);
  let corpse = a.game.view().view.entities.find((e) => e.name === 'item.npc_corpse.short');
  for (let i = 0; i < 20 && !corpse; i++) {
    a.clock.wall += 3000;
    a.clock.mono += 3000;
    assert.equal(a.game.pulse().kind, 'ready');
    corpse = a.game.view().view.entities.find((e) => e.name === 'item.npc_corpse.short');
  }
  assert.ok(corpse);
  const ear = corpse.contents!.find((e) => e.name === 'item.ear.short')!;
  const first = book(chapter, a);
  first.tap(first.labels().find((x) => x.includes('corpse') && x.includes('open'))!);
  first.tap(first.labels().find((x) => x.includes('goblin ear') && x.includes('open'))!);
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
      .filter((x: string) => x === 'You pick up a goblin ear.').length,
    1,
  );
  assert.equal(remounted.p.screen().log.includes('You pick up a goblin ear.'), false);
  assert.ok(a.game.view().view.inventory.some((e) => e.id === ear.id));
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
  const drawnLook = h.draw().find((n) => n.props.accessibilityLabel === 'Ferry Landing, look');
  assert.ok(drawnLook);
  const receipts = () => h.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n;
  assert.equal(receipts(), 0);
  const token = h.game.view().token;
  h.tap('Ferry Landing, look');
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
  h.tap(CONTENTS);
  h.tap(LABEL.inventory);
  h.tap('Back to World');
  assert.ok(h.labels().includes('Old Bram, open'));
  assert.equal(h.labels().includes(`${LABEL.inventory}, open`), false);
  const sections = ['Character', LABEL.inventory, 'Map', 'Journal', 'Settings'];
  for (const section of sections) {
    h.tap(CONTENTS);
    assert.deepEqual(
      h.labels().filter((label) => sections.some((s) => label === `${s}, open`)),
      sections.map((s) => `${s}, open`),
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
  h.tap('Old Bram');
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
  h.tap('Leave the conversation');
  h.tap('Leave');
  h.map();
  h.tap('Go north'); // a fresh move, not a replay of the committed choice
  assert.ok(h.text().includes('Well Lane'));
  assert.equal(
    h.p
      .screen()
      .detail(speaker)
      .filter((s: string) => s === result).length,
    0, // the closed visit's history is dropped; a replayed choice would write it again
  );
  assert.equal(h.p.screen().fault, undefined);
  assert.deepEqual(h.p.screen().log, []);
  h.tap('A brass lantern');
  h.tap('Take a brass lantern');
  assert.deepEqual(h.p.screen().log, ['You pick up a brass lantern.']);
  h.sql.close();
});

// Breaks: Leave is redundant or closes optimistically, journal cues look like speech, controls leave
// the log, or an ended conversation offers Talk again instead of Leave the conversation (owner 2026-10-09).
test('NPC history has distinct journal events and one confirmed Leave in the foot below the log', () => {
  const h = book();
  h.tap('Old Bram');
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
    ["Offer to fetch Bram's lantern"],
  );
  const page = h.draw(); // preorder: the scroll's subtree follows it, then the foot
  const end = page.findIndex((n) => n.type === 'ScrollView') + nodes(scroll).length;
  const leave = (n: any) =>
    n.type === 'Pressable' && n.props.accessibilityLabel === 'Leave the conversation';
  assert.equal(page.filter(leave).length, 1);
  assert.ok(page.findIndex(leave) >= end);
  h.tap('Leave the conversation');
  assert.equal(h.game.view().view.choice, undefined);
  assert.ok(h.labels().includes('Talk to Old Bram')); // closing returns to Bram's page, not World
  assert.equal(h.text().includes(prompt), false); // a clean page: the left conversation is hidden
  h.tap('Leave');
  h.tap('Old Bram');
  h.tap('Talk to Old Bram');
  h.tap(CONTENTS);
  h.tap('Map');
  h.tap('Go north'); // local section navigation preserves the pending choice
  h.tap('Continue conversation');
  h.tap('Leave the conversation'); // actual offered Close works without a projected speaker
  assert.equal(h.game.view().view.choice, undefined);
  h.map();
  h.tap('Go south');
  h.tap('Old Bram');
  h.tap('Talk to Old Bram');
  const beforeResult = turn();
  h.tap("Offer to fetch Bram's lantern");
  assert.equal(turn(), beforeResult);
  // each visit starts empty: the earlier visits' prompts are not shown again (loka-x6t.19)
  assert.deepEqual(h.p.screen().detail(speaker), [
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
  // The reply ended the kernel conversation; the page stays in it: no Talk, only its Leave.
  assert.equal(
    flow.findIndex((n) => n.type === 'Pressable'),
    -1,
  );
  assert.ok(h.labels().includes('Leave the conversation'));
  assert.ok(!h.labels().includes('Talk to Old Bram'));
  h.tap(CONTENTS); // leaving by Contents also ends it: the later fresh visit offers Talk again
  h.tap('Map');
  assert.equal(h.text().includes('Journal updated'), false);
  h.tap('Go north');
  h.tap('A brass lantern');
  const drawnTake = h.draw().find((n) => n.props.accessibilityLabel === 'Take a brass lantern');
  h.clock.wall += 250;
  h.clock.mono += 250;
  assert.equal(h.game.pulse().kind, 'ready');
  drawnTake.props.onPress(); // Breaks: the old-token shortcut keeps an item page after confirmed pickup.
  h.map();
  h.tap('Go south');
  h.tap('Old Bram');
  assert.equal(h.text().includes('Journal updated'), false); // a fresh visit hides past talk
  h.tap('Talk to Old Bram');
  assert.equal(h.text().includes('Journal updated'), false); // nor does a new conversation (loka-x6t.19)
  h.tap('Keep the lantern');
  assert.equal(h.game.view().view.scene!.index, 1);
  assert.deepEqual(h.labels(), ['Continue']);
  h.sql.close();
});

// Breaks: direct cycling opens a page, flips World, skips a legal state or reuses a new freshness token.
test('only World position taps directly cycle the offered states with captured freshness', () => {
  const h = book();
  const turn = h.draw().find((n) => n.type.name === 'PageTurn').props.turn;
  const drawn = h.draw().find((n) => n.props.accessibilityLabel === 'standing, change position');
  for (const [from, to, line] of [
    ['standing', 'sitting', 'You sit down.'],
    ['sitting', 'resting', 'You settle down to rest.'],
    ['resting', 'sleeping', 'You lie down to sleep.'],
    ['sleeping', 'standing', 'You stand up.'],
  ]) {
    h.tap(`${from}, change position`);
    assert.equal(h.game.view().view.position, to);
    assert.equal(h.text().filter((s: string) => s === line).length, 1, line); // one World line (loka-x6t.22)
    assert.equal(h.draw().find((n) => n.type.name === 'PageTurn').props.turn, turn);
    assert.ok(h.labels().includes('Old Bram, open'));
  }
  const token = h.game.view().token;
  drawn.props.onPress();
  assert.equal(h.game.view().token, token);
  assert.equal(h.game.view().view.position, 'standing');
  h.tap(CONTENTS);
  h.tap('Character');
  assert.deepEqual(
    h.labels().filter((s) => ['Stand', 'Sit', 'Rest', 'Sleep'].includes(s)),
    [],
  );
  assert.equal(h.labels().includes('standing, change position'), false);
  h.sql.close();
});

// Breaks: retrying an NPC's unconfirmed choice from Map forgets its original detail context.
test('an NPC choice retried from the world keeps its result in the original detail', () => {
  const h = book();
  h.tap('Old Bram');
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
  h.tap(CONTENTS);
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
  const derived = compiled('cartridges/derived_sampler');
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, derived as never);
  const h = book(derived as never, a);
  const choices = ['Hardy', 'Nimble', 'Strong'];
  assert.deepEqual(h.labels(), choices);
  a.fault.kind = 'lost';
  a.fault.armed = true;
  h.tap('Strong');
  assert.equal(h.game.pending(), true);
  assert.deepEqual(h.labels(), choices);
  assert.ok(h.text().includes('save not confirmed'));
  a.fault.reads = false;
  h.tap('Hardy');
  assert.equal(h.game.pending(), false);
  assert.equal(h.game.view().view.ancestry_choices, undefined);
  assert.equal(h.game.view().view.ancestry, 'strong');
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, 1);
});

// Breaks: NPCs and loose items share one "are here" sentence, an NPC is listed among the items or
// dropped, a group loses its comma form or "is"/"are", or an empty group leaves its own sentence (book-ui.md, World and status entry).
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
          actions: [],
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
        (n) => n.type === 'Text' && !n.props.onPress && nodes(n.props.children).some(pressable),
      )
      .map(words);
  const room = [
    entity('satchel', 'item'),
    entity('nell', 'npc'),
    entity('lamp', 'item'),
    entity('tam', 'npc'),
  ];
  assert.deepEqual(groups(room), [
    'Nell and tam are here.', // one sentence per group, only its first name capitalised
    'Satchel and lamp are here.',
  ]);
  assert.deepEqual(groups([entity('lamp', 'item')]), ['Lamp is here.']);
});

// Breaks: the Map foot loses Back to map or its clear, or Back to World leaves a page on the stack.
test('a chosen map place adds Back to map before Back to World', () => {
  const h = book(compiled('cartridges/toolbox_showcase') as never);
  h.map();
  const returns = () => h.labels().filter((x) => x.startsWith('Back to'));
  h.tap('Crossroads Inn, current place');
  assert.deepEqual(returns(), ['Back to map', 'Back to World']);
  h.tap('Back to map');
  assert.deepEqual(returns(), ['Back to World']);
  h.tap('Back to World');
  assert.deepEqual(h.stack, []);
  h.sql.close();
});

// Breaks: a return turns forward or an opened page turns back (BOOK-UI-COMPONENTS.md#page-turn,
// Direction).
test('opening a page turns forward and Back to World turns back', () => {
  const h = book();
  const dir = () => h.draw().find((n) => n.type.name === 'PageTurn').props.dir;
  const contents = () => h.tap(CONTENTS);
  contents();
  h.tap('Back to World');
  assert.equal(dir(), -1);
  contents();
  assert.equal(dir(), 1);
  h.sql.close();
});

// Breaks: the Book ignores the confirmed solar phase, or a component reads a fixed palette instead
// of the one the Book provides. bleed_sampler opens at dusk, its `dusk` cut.
test('a dusk GameView draws the Book in the dusk palette', () => {
  const h = book(bundle('bleed_sampler_hash'));
  assert.equal(h.game.view().view.calendar_status?.solar, 'dusk');
  const drawn = h.draw();
  assert.equal(drawn.find((n) => n.type === 'SafeAreaView').props.style.backgroundColor, '#2c2846');
  const title = drawn.find((n) => n.type === 'Text' && n.props.style?.fontSize === 26); // the room title
  assert.equal(title.props.style.color, '#e8e2ec');
});
