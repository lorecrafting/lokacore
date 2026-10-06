// D3 current compiled source: real rollback-journal SQLite and existing Book presenter/routes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  bundle,
  fresh,
  ref,
  room,
  entity,
  prefix,
} from '../../../kernel/ts/test/transport_fixture.ts';
import { openStory } from './authority.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { presenter } from '../../app/book/presenter.ts';
import { pagesAfter } from '../../app/book/model.ts';

const start = (c: any) => {
  c.entry = ref('room', 'ferry_landing');
  c.calendar.start = 64800;
  c.resources[`${prefix}:resource/pennies`].start = 20;
};
function setup(path: string, change = start) {
  const b = bundle(change),
    initial = fresh(change);
  let p = elapsedHost(path, { wall: 10000, mono: 0 }, b),
    book = presenter(p.game);
  p.game.subscribe(book.update);
  const world = () => {
    const s = openStory(p.db, [{ fresh: initial, content_hash: b.sha256 }], p.host);
    assert.equal(s.kind, 'open', JSON.stringify(s));
    if (s.kind !== 'open') throw new Error('Western Ashmere save');
    return s.world();
  };
  const invoke = (action_key: string, target_ids: string[] = [], input: object = {}) => {
    const r = p.game.invoke({ action_key, target_ids, input } as never);
    assert.equal(r.kind === 'saved' && r.decision.kind, 'accepted', JSON.stringify(r));
    return r;
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => invoke('move', [], { direction }));
  return {
    initial,
    content_hash: b.sha256,
    world,
    invoke,
    move,
    get p() {
      return p;
    },
    get book() {
      return book;
    },
    view: () => p.game.view().view,
    reopen() {
      p.sql.close();
      p = elapsedHost(path, { wall: 10000, mono: 0 }, b);
      book = presenter(p.game);
      p.game.subscribe(book.update);
      world();
    },
    advance(until: number) {
      assert.equal(p.game.pulse().kind, 'ready');
      p.clock.mono += (until - world().state.clock) * 20;
      p.clock.wall += (until - world().state.clock) * 20;
      let status = p.game.pulse();
      for (let n = 0; status.kind === 'catching_up' && n < 100; n++) status = p.game.pulse('drain');
      assert.equal(status.kind, 'ready', JSON.stringify(status));
      assert.equal(world().state.clock, until);
    },
  };
}
const ledgerBody =
  'Grain received, flour delivered. Hob has balanced every line; a note in the margin reads: Mind the loose board upstairs.';
const signBody =
  'This cottage is for sale. Enquiries may be left with the miller. No terms have been agreed.';
// Break: a new-room Read leaks into World or changes gameplay, or its legal receipt/new-room custody fails a cold SQLite open.
test('Western rooms and both exact standalone Read histories survive cold SQLite reopen without story credit', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-d3-read-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const a = setup(join(dir, 'save.db'));
  t.after(() => a.p.sql.close());
  a.move('west', 'south');
  for (const [name, title, body] of [
    ['ledger', "Hob's ledger", ledgerBody],
    ['sign', 'For-sale sign', signBody],
  ]) {
    if (name === 'sign') a.move('south');
    const notice = a.view().notices![0];
    assert.equal(a.p.game.text(notice.title), title);
    const before = a.world().state;
    const button = a.book
      .screen()
      .buttons.find(
        (b) => (b.command ?? b.action_key) === 'read' && b.target_ids[0] === notice.id,
      )!;
    assert.ok(button);
    assert.deepEqual(button.target_ids, [notice.id]);
    a.book.press(button, notice.id);
    assert.deepEqual(a.book.screen().detail(notice.id), [body]);
    assert.deepEqual(a.book.screen().log, []);
    const after = a.world().state;
    assert.deepEqual(after, before);
    a.reopen();
    assert.deepEqual(a.book.screen().detail(notice.id), [body]);
    assert.deepEqual(a.book.screen().log, []);
    assert.deepEqual(pagesAfter([{ kind: 'notice', id: notice.id }], a.view(), a.view()), [
      { kind: 'notice', id: notice.id },
    ]);
  }
  for (const [direction, expected] of [
    ['up', 'cottage_loft'],
    ['down', 'empty_cottage'],
    ['north', 'old_mill'],
    ['up', 'mill_loft'],
    ['down', 'old_mill'],
    ['down', 'mill_cellar'],
    ['up', 'old_mill'],
    ['north', 'boathouse'],
    ['east', 'ferry_landing'],
  ]) {
    const before = a.view();
    a.move(direction);
    assert.deepEqual(
      pagesAfter([{ kind: 'notice', id: before.notices?.[0]?.id ?? 'gone' }], before, a.view()),
      [],
    );
    a.reopen();
    assert.equal(a.view().place.id, room(a.initial, expected));
  }
  assert.equal(a.content_hash, '5d48ad7fb4402de91c775dfe9395949ed1c1fe73d4bf0e13f2cb29717c1c1fdf');
});
// Break: Hob's saved schedule transfer or a departed dialogue speaker fails legal reopen.
test('Hob departure and return retain original identity and saved Conversation Leave at the two dawn/dusk boundaries', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-d3-hob-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const a = setup(join(dir, 'save.db'), (c) => {
    start(c);
    c.items[`${prefix}:item/torch`].location = { in: 'room', room: ref('room', 'ferry_landing') };
    c.items[`${prefix}:item/torch`].fuel.capacity = 100000;
    c.items[`${prefix}:item/torch`].fuel.initial = 100000;
    c.npcs[`${prefix}:npc/peg`].shop.offers = c.npcs[`${prefix}:npc/peg`].shop.offers.filter(
      (o: any) => o.item.key !== 'torch',
    );
  });
  t.after(() => a.p.sql.close());
  const hob = entity(a.initial, 'npc', 'hob'),
    torch = entity(a.initial, 'item', 'torch');
  a.invoke('take', [torch]);
  a.invoke('ignite', [torch]);
  a.move('west', 'south', 'up');
  const talk = a.book
    .screen()
    .buttons.find((b) => b.action_key === 'hob' && b.target_ids[0] === hob)!;
  assert.ok(talk);
  assert.deepEqual(talk.target_ids, [hob]);
  a.book.press(talk, hob);
  const before = a.view();
  a.advance(108000);
  assert.deepEqual(pagesAfter([{ kind: 'thing', id: hob }], before, a.view()), [
    { kind: 'dialogue', speaker: hob },
  ]);
  a.reopen();
  assert.equal(
    a.view().entities.some((e) => e.id === hob),
    false,
  );
  a.invoke('close_choice', [], { continuation_id: a.view().choice!.continuation_id });
  a.move('down');
  assert.equal(a.view().entities.find((e) => e.id === hob)?.name, 'npc.hob.short');
  a.advance(151200);
  a.reopen();
  assert.equal(
    a.view().entities.some((e) => e.id === hob),
    false,
  );
  a.move('up');
  a.reopen();
  assert.equal(a.view().entities.find((e) => e.id === hob)?.name, 'npc.hob.short');
});
// Break: actual Chapel death return cannot reach either dark branch or recover its sole original light nested in the owned corpse.
test('actual death returns gearless through Chapel and recovers original nested possessions in both dark mill branches', (t) => {
  for (const [destination, direction, back] of [
    ['mill_loft', 'up', 'down'],
    ['mill_cellar', 'down', 'up'],
  ]) {
    const dir = mkdtempSync(join(tmpdir(), 'loka-d3-recovery-'));
    t.after(() => rmSync(dir, { recursive: true }));
    const a = setup(join(dir, 'save.db'), (c) => {
      start(c);
      c.resources[`${prefix}:resource/hp`].start = 1;
      c.resources[`${prefix}:resource/hp`].gain = 0;
      for (const item of ['torch', 'satchel'])
        c.items[`${prefix}:item/${item}`].location = {
          in: 'room',
          room: ref('room', 'ferry_landing'),
        };
      c.npcs[`${prefix}:npc/peg`].shop.offers = c.npcs[`${prefix}:npc/peg`].shop.offers.filter(
        (o: any) => !['torch', 'satchel'].includes(o.item.key),
      );
      const rat = structuredClone(c.npcs[`${prefix}:npc/cellar_rat_1`]);
      rat.key = 'mill_test_rat';
      rat.room = ref('room', destination);
      rat.attack = { chance: 100, damage_min: 10, damage_max: 10 };
      rat.perception = { discovered: ref('fact', 'fen_wisp_discovered') };
      c.npcs[`${prefix}:npc/mill_test_rat`] = rat;
      c.rooms[`${prefix}:room/ferry_landing`].details.glow = structuredClone(
        c.rooms[`${prefix}:room/marsh_light`].details.glow,
      );
      c.recipes[`${prefix}:recipe/seek_wisp`].target.room = ref('room', 'ferry_landing');
      c.world.combat.player_attack.chance = 0;
    });
    t.after(() => a.p.sql.close());
    const torch = entity(a.initial, 'item', 'torch'),
      bag = entity(a.initial, 'item', 'satchel');
    a.invoke('seek_wisp');
    a.invoke('take', [bag]);
    a.invoke('take', [torch]);
    a.invoke('ignite', [torch]);
    a.move('west', 'south', direction);
    a.invoke('put', [torch, bag]);
    a.invoke('attack', [entity(a.initial, 'npc', 'mill_test_rat')]);
    const due = Object.values(a.world().state.jobs!).find(
      (j) => j.status === 'pending' && j.encounter_id,
    )!.due_time;
    a.advance(due);
    a.reopen();
    const w = a.world();
    const corpse = Object.entries(w.state.created!).find(
      ([, row]) => row.origin.kind === 'death' && row.origin.owner_id === w.character,
    )![0];
    assert.equal(a.view().place.id, room(a.initial, 'chapel_nave'));
    assert.deepEqual(a.view().inventory, []);
    assert.equal(w.state.containers[corpse], room(a.initial, destination));
    assert.equal(w.state.containers[bag], corpse);
    assert.equal(w.state.containers[torch], bag);
    assert.equal(w.state.fuel![torch].lit, true);
    a.move('south', 'south', 'south', 'south', 'south', 'west', 'south', direction);
    a.reopen();
    assert.equal(a.view().place.description.key, `room.${destination}.dark`);
    assert.equal(a.view().exits[0].direction, back);
    const visible = a.view().entities.find((e) => e.id === corpse)!;
    assert.ok(visible);
    assert.equal(visible.contents!.find((e) => e.id === torch)!.container_id, bag);
    a.invoke('take', [torch]);
    a.reopen();
    a.invoke('take', [bag]);
    a.reopen();
    assert.equal(a.world().state.containers[torch], w.body);
    assert.equal(a.world().state.containers[bag], w.body);
    a.move(back, 'north', 'east');
    a.reopen();
    assert.equal(a.view().place.id, room(a.initial, 'ferry_landing'));
  }
});
