// Real elapsed pulses and SQLite receipts: old controls keep their action/context, not a frozen clock.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  elapsedBundle,
  elapsedHost,
} from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { intentOf } from './model.ts';
import { gesture, ZOOM } from './joystick.ts';
import { presenter } from './presenter.ts';

function preview(
  bundle = JSON.parse(
    readFileSync(
      new URL('../../../protocol/fixtures/containers_cartridge_sampler_hash.json', import.meta.url),
      'utf8',
    ),
  ),
) {
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, bundle);
  const book = presenter(a.game);
  a.game.subscribe(book.update);
  const button = (label: string) =>
    book.screen().buttons.find((b) => b.label === label) ?? assert.fail(label);
  const tap = (...labels: string[]) => labels.forEach((label) => book.press(button(label)));
  const pulse = () => {
    a.clock.wall += 250;
    a.clock.mono += 250;
    assert.equal(a.game.pulse().kind, 'ready');
  };
  const revision = () => a.sql.prepare('SELECT revision FROM head').get()!.revision;
  return { ...a, book, button, tap, pulse, revision };
}

// Breaks: any live-clock revision strands a human-length drag, or the presenter weakens authority
// freshness rather than rebinding only its own still-offered action.
test('after Bram acceptance an unchanged north drag crosses a pulse and commits exactly one move', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  a.tap('Talk to Old Bram');
  const accept = a.book
    .screen()
    .buttons.find(
      (b) =>
        b.action_key === 'choose' && (b.input as { choice_id?: string }).choice_id === 'accept',
    )!;
  assert.ok(accept);
  a.book.press(accept);
  assert.equal(a.book.screen().view.choice, undefined);
  assert.equal(a.book.screen().view.journal[0]!.state, 'active');
  const revision = Number(a.revision());
  const props = () => {
    const drawn = a.book.screen();
    return {
      exits: drawn.view.exits,
      go: (d: string) => a.book.press(drawn.buttons.find((b) => b.label === `Go ${d}`)!),
    };
  };
  const now = { current: props() };
  const nothing = () => {};
  const g = gesture({
    now,
    walk: (d, at) => d && at.go(d),
    openMap: () => assert.fail('a drag must not open Map'),
    setLit: nothing,
    setNote: nothing,
    zoom: nothing,
    knob: nothing,
  });
  const old = a.button('Go north');
  const time = a.book.screen().view.time;
  g.onPanResponderGrant();
  a.pulse();
  assert.ok(a.book.screen().view.time > time);
  assert.notEqual(old.token, a.game.view().token);
  assert.equal(a.game.invoke(intentOf(old)).kind, 'stale_view'); // authority stays strict
  now.current = props();
  g.onPanResponderMove(null, { dx: 0, dy: -20 * ZOOM });
  g.onPanResponderRelease();
  assert.equal(a.book.screen().view.place.title.key, 'room.well_lane.title');
  assert.equal(a.revision(), revision + 2); // one elapsed receipt and one movement receipt
  assert.equal(a.book.recovered(), true);
  assert.equal(a.book.screen().log.includes('The page had changed; here it is again.'), false);
});

// Breaks: retaining Bram's old daily schedule hides the offer at19:00 or blocks
// the lantern hand-over the next day, forcing the sampler player to wait.
test('sampler Bram offers at19:00 and receives the fetched lantern the next day without waiting', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  a.clock.wall += 72000;
  a.clock.mono += 72000;
  assert.equal(a.game.pulse().kind, 'ready');
  assert.equal(a.book.screen().view.time, 68400);
  a.tap('Talk to Old Bram', 'Close', 'Talk to Old Bram');
  a.book.press(a.book.screen().buttons.find((b) => b.action_key === 'choose')!);
  assert.equal(a.book.screen().view.journal[0]!.state, 'active');
  a.tap('Go north');
  a.clock.wall += 1728000;
  a.clock.mono += 1728000;
  assert.equal(a.game.pulse().kind, 'ready');
  assert.equal(a.book.screen().view.time, 154800);
  a.tap('Take a brass lantern', 'Go south', 'Talk to Old Bram');
  const leave = a.book
    .screen()
    .buttons.find(
      (b) =>
        b.action_key === 'choose' && (b.input as { choice_id?: string }).choice_id === 'leave_it',
    )!;
  assert.ok(leave);
  a.book.press(leave);
  assert.equal(a.book.screen().view.journal[0]!.state, 'resolved');
  assert.equal(
    JSON.parse(
      a.sql
        .prepare("SELECT value FROM state_row WHERE section='containers' AND key=?")
        .get('05f6aca0-79cd-83fe-8096-bae95b0730e8')!.value as string,
    ),
    '15349791-fa65-81f7-b378-bb8212b808d2',
  );
});

// Breaks: refreshing a held north action after another move turns it into a second move from
// the new room, where north is also offered. Both actions have identical input and target IDs.
test('a captured north action never becomes north from a different origin room', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  const old = a.button('Go north');
  const reply = a.game.invoke(intentOf(old)); // an authoritative update outside this control
  assert.equal(
    reply.kind === 'saved' && reply.decision.kind === 'accepted' && reply.decision.outcome,
    'moved',
  );
  a.pulse();
  const revision = a.revision();
  assert.ok(a.button('Go north'));
  a.book.press(old);
  assert.equal(a.book.screen().view.place.title.key, 'room.well_lane.title');
  assert.equal(a.revision(), revision);
  assert.equal(a.book.screen().log.at(-1), 'The page had changed; here it is again.');
  assert.equal(a.book.recovered(), false);
});

// Breaks: elapsed-only revisions strand Maud's offered choice, position controls or item actions.
test('Maud acceptance, position and item buttons survive elapsed-only redraws', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  const sit = a.button('Sit');
  a.pulse();
  a.book.press(sit);
  assert.equal(a.book.screen().view.position, 'sitting');
  a.tap('Stand', 'Go north');
  const take = a.button('Take a brass lantern');
  a.pulse();
  a.book.press(take);
  assert.ok(
    a.book.screen().view.inventory.some((i) => i.id === '05f6aca0-79cd-83fe-8096-bae95b0730e8'),
  );
  a.tap('Go east', 'Talk to Widow Maud');
  const accept = a.book
    .screen()
    .buttons.find(
      (b) =>
        b.action_key === 'choose' && (b.input as { choice_id?: string }).choice_id === 'accept',
    )!;
  assert.ok(accept);
  a.pulse();
  const revision = a.revision();
  a.book.press(accept, 'f14e477f-cecc-897a-bee7-c573aa5c76c3');
  assert.equal(a.revision(), Number(revision) + 1);
  assert.equal(a.book.screen().view.choice, undefined);
  assert.ok(
    a.book
      .screen()
      .view.journal.some((q) => q.quest.key === 'mauds_cellar' && q.state === 'active'),
  );
  assert.equal(a.book.screen().log.includes('The page had changed; here it is again.'), false);
  const west = a.button('Go west');
  a.pulse();
  a.book.press(west);
  assert.equal(a.book.screen().view.place.title.key, 'room.well_lane.title');
  assert.equal(a.book.screen().log.includes('The page had changed; here it is again.'), false);
});

// Breaks: a handler reuses an old button's captured context but alters the choice it sends;
// matching an offered action against that context alone would silently refresh the altered input.
test('an altered captured choice is refused without sending a new decision', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  a.tap('Go north', 'Go east', 'Talk to Widow Maud');
  const accept = a.book.screen().buttons.find((b) => b.action_key === 'choose')!;
  a.pulse();
  const revision = a.revision();
  a.book.press({ ...accept, input: { ...accept.input, choice_id: 'done' } });
  assert.equal(a.revision(), revision);
  assert.equal(a.book.screen().view.journal.length, 0);
  assert.equal(a.book.screen().log.at(-1), 'The page had changed; here it is again.');
});

// Breaks: a previous Leave button closes the next conversation because both close actions have
// no input or targets. A departed Bram must also never be substituted by a new current target.
test('old Leave and departed Bram actions keep stale refusal after context changes', (t) => {
  const a = preview(elapsedBundle());
  t.after(() => a.sql.close());
  a.book.press(a.book.screen().buttons.find((b) => b.action_key === 'lantern')!);
  const talk = a.button('Talk Bram the ferryman');
  a.book.press(talk);
  const close = a.button('Close');
  a.book.press(close);
  a.tap('Talk Bram the ferryman');
  const continuation = a.book.screen().view.choice!.continuation_id;
  const revision = a.revision();
  a.book.press(close);
  assert.equal(a.revision(), revision);
  assert.equal(a.book.screen().view.choice!.continuation_id, continuation);
  assert.equal(a.book.screen().log.at(-1), 'The page had changed; here it is again.');
  a.tap('Close');
  const beforeDeparture = a.button('Talk Bram the ferryman');
  a.clock.wall += 720000;
  a.clock.mono += 720000;
  assert.equal(a.game.pulse().kind, 'ready');
  assert.equal(
    a.book.screen().buttons.some((b) => b.label === 'Talk Bram the ferryman'),
    false,
  );
  const afterDeparture = a.revision();
  a.book.press(beforeDeparture);
  assert.equal(a.revision(), afterDeparture);
  assert.equal(a.book.screen().view.choice, undefined);
  assert.equal(a.book.screen().log.at(-1), 'The page had changed; here it is again.');
});

// Breaks: the same saved continuation is mistaken for a still-offered answer after its speaker
// departs; rebinding would send a new action instead of preserving the captured stale refusal.
test('a held answer refuses after its speaker departs during the elapsed pulse', (t) => {
  const a = preview(elapsedBundle());
  t.after(() => a.sql.close());
  a.book.press(a.book.screen().buttons.find((b) => b.action_key === 'lantern')!);
  a.tap('Take a brass lantern', 'Talk Bram the ferryman');
  const answer = a.book.screen().buttons.find((b) => b.action_key === 'choose')!;
  assert.ok(answer);
  const continuation = a.book.screen().view.choice!.continuation_id;
  a.clock.wall += 720000;
  a.clock.mono += 720000;
  assert.equal(a.game.pulse().kind, 'ready');
  assert.equal(a.book.screen().view.choice!.continuation_id, continuation);
  assert.equal(
    a.book.screen().buttons.some((b) => b.action_key === 'choose'),
    false,
  );
  const revision = a.revision();
  a.book.press(answer);
  assert.equal(a.revision(), revision);
  assert.equal(a.book.screen().view.journal[0]!.state, 'active');
  assert.equal(a.book.screen().log.at(-1), 'The page had changed; here it is again.');
});

// Breaks: the same room's Look button is refreshed across entering an encounter, bypassing the
// captured combat context. An unchanged in-combat Look should still survive a harmless pulse.
test('combat context changes refuse old Look while an unchanged encounter tolerates a pulse', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  a.tap('Go north', 'Go east', 'Go down');
  const beforeFight = a.button('Look');
  const attack = a.book.screen().buttons.find((b) => b.action_key === 'attack')!;
  assert.ok(attack);
  a.book.press(attack);
  assert.ok(a.book.screen().view.combat);
  const revision = a.revision();
  a.book.press(beforeFight);
  assert.equal(a.revision(), revision);
  assert.equal(a.book.screen().combatLog.at(-1), 'The page had changed; here it is again.');
  const current = a.button('Look');
  const encounter = a.book.screen().view.combat!.encounter_id;
  a.pulse();
  a.book.press(current);
  assert.equal(a.book.screen().view.combat!.encounter_id, encounter);
  assert.equal(a.book.recovered(), true);
  assert.equal(a.revision(), Number(revision) + 2);
});

// Breaks: an uncertain-COMMIT retry gets replaced by a new invocation/updated token, duplicates
// the already-durable move or loses its original receipt/context when another button is pressed.
test('pending move retry adopts its original durable receipt once without a second action', (t) => {
  const a = preview();
  t.after(() => a.sql.close());
  const north = a.button('Go north');
  a.fault.kind = 'lost';
  a.fault.armed = true;
  a.book.press(north);
  assert.equal(a.game.pending(), true);
  const id = a.game.pendingInvocation();
  assert.ok(id);
  assert.equal(a.book.screen().view.place.title.key, 'room.ferry_landing.title');
  const original = a.sql
    .prepare('SELECT command, response FROM receipt WHERE invocation_id = ?')
    .get(id);
  assert.ok(original);
  a.fault.reads = false;
  a.book.press(a.button('Sleep'));
  assert.equal(a.game.pending(), false);
  assert.equal(a.book.screen().view.place.title.key, 'room.well_lane.title');
  assert.equal(a.revision(), 1);
  assert.deepEqual(
    a.sql.prepare('SELECT command, response FROM receipt WHERE invocation_id = ?').get(id),
    original,
  );
});
