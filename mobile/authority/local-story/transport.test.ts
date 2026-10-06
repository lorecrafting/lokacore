// D1 uses the real rollback-journal SQLite host, not browser refresh as a fault oracle.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  bundle,
  fresh,
  ref,
  room,
  entity,
  endpoint,
  pennies,
  prefix,
} from '../../../kernel/ts/test/transport_fixture.ts';
import { resolved } from '../../../kernel/ts/src/commands/actions.ts';
import { gameView } from '../../../kernel/ts/src/index.ts';
import { membership } from '../../../kernel/ts/src/mechanics/skills.ts';
import { openStory } from './authority.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { presenter } from '../../app/book/presenter.ts';
import { group, pagesAfter, intentOf } from '../../app/book/model.ts';

function setup(path = ':memory:', change: (c: any) => void = () => {}) {
  const b = bundle(change),
    initial = fresh(change),
    releases = [{ fresh: initial, content_hash: b.sha256 }] as const;
  let p = elapsedHost(path, { wall: 10000, mono: 0 }, b),
    n = 0;
  const open = () => {
    const s = openStory(p.db, releases, p.host);
    assert.equal(s.kind, 'open', JSON.stringify(s));
    if (s.kind !== 'open') throw new Error('transport save');
    return s;
  };
  let story = open();
  const attempt = (action_key: string, input: object = {}, target_ids: string[] = []) => ({
    invocation_id: `cccccccc-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    actor_id: initial.character,
    action_key,
    input,
    target_ids,
  });
  const invoke = (action: string, input: object = {}, ids: string[] = []) => {
    const keyed =
      action === 'talk'
        ? gameView(story.world())
            .entities.find((e) => e.id === ids[0])
            ?.actions.find(
              (a) =>
                resolved(story.world(), initial.character)[a.action_key]?.command === 'talk' &&
                a.available,
            )?.action_key
        : action;
    const i = attempt(keyed ?? action, input, ids),
      r = story.invoke(i);
    assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted', JSON.stringify(r));
    return i;
  };
  const ferry = (key = 'fen_outbound') =>
    attempt(
      key === 'fen_outbound' ? 'board_ferry' : 'return_ferry',
      { route: ref('transport', key), quoted_fare: key === 'fen_outbound' ? 2 : 0 },
      [endpoint(initial, key)],
    );
  const cross = (key = 'fen_outbound') => {
    const i = ferry(key),
      r = story.invoke(i);
    assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted', JSON.stringify(r));
    return i;
  };
  return {
    initial,
    b,
    releases,
    attempt,
    invoke,
    ferry,
    cross,
    get story() {
      return story;
    },
    get sql() {
      return p.sql;
    },
    get fault() {
      return p.fault;
    },
    get game() {
      return p.game;
    },
    get db() {
      return p.db;
    },
    get host() {
      return p.host;
    },
    reopen() {
      if (path !== ':memory:') {
        p.sql.close();
        p = elapsedHost(path, { wall: 10000, mono: 0 }, b);
      }
      story = open();
    },
    refuse: () => openStory(p.db, releases, p.host),
  };
}
const disk = (a: ReturnType<typeof setup>) =>
  ['state_row', 'head', 'receipt'].map((t) =>
    a.sql.prepare(`SELECT * FROM ${t} ORDER BY 1,2`).all(),
  );
const truth = (a: ReturnType<typeof setup>) => ({
  money: pennies(a.story.world()),
  place: a.story.world().state.containers[a.initial.body],
  swim: membership(a.story.world(), a.initial.character, ref('skill', 'swim')),
});
function lesson(a: ReturnType<typeof setup>) {
  a.invoke('move', { direction: 'east' });
  a.invoke('talk', {}, [entity(a.initial, 'npc', 'sedge')]);
  return a.attempt('choose', {
    continuation_id: gameView(a.story.world()).choice!.continuation_id,
    choice_id: 'learn',
  });
}

// Breaks: fare, room entry or free acquired skill fails cold reopen/replay, or old transport evidence depends on later room custody.
test('paid crossing, free Sedge lesson, six-room exploration and return reopen at committed boundaries', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-transport-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const a = setup(join(dir, 'save.db'));
  t.after(() => a.sql.close());
  a.reopen();
  const out = a.cross();
  a.reopen();
  assert.deepEqual(pennies(a.story.world()), [1, 2]);
  assert.equal(
    a.story.world().state.containers[a.initial.body],
    room(a.initial, 'fen_isle_landing'),
  );
  assert.equal(a.story.invoke(out).kind, 'saved');
  assert.deepEqual(pennies(a.story.world()), [1, 2]);
  const learn = lesson(a);
  const r = a.story.invoke(learn);
  assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted');
  a.reopen();
  assert.equal(truth(a).swim, true);
  assert.deepEqual(truth(a).money, [1, 2]);
  assert.equal(a.story.invoke(learn).kind, 'saved');
  a.invoke('move', { direction: 'up' });
  a.reopen();
  assert.equal(gameView(a.story.world()).exits[0].direction, 'down');
  a.invoke('move', { direction: 'down' });
  a.invoke('move', { direction: 'east' });
  a.reopen();
  a.invoke('move', { direction: 'west' });
  a.invoke('move', { direction: 'west' });
  a.invoke('move', { direction: 'south' });
  a.reopen();
  a.invoke('move', { direction: 'north' });
  a.cross('fen_return');
  a.reopen();
  assert.deepEqual(truth(a), { money: [1, 2], place: room(a.initial, 'boathouse'), swim: true });
});
// Breaks: malformed charge, endpoint/recipient, body transfer or room entry is accepted during historical validation and silently repaired.
test('forged ferry receipts and saved custody refuse typed corruption without changing the database', () => {
  for (const mutation of ['payment', 'recipient', 'endpoint', 'quote', 'move', 'entry', 'state']) {
    const a = setup();
    try {
      a.cross();
      const row = a.sql
          .prepare(
            "SELECT invocation_id,command,response FROM receipt WHERE json_extract(command,'$.payload.type')='use_transport'",
          )
          .get()!,
        c = JSON.parse(row.command as string),
        d = JSON.parse(row.response as string);
      if (mutation === 'payment')
        d.delta.ops = d.delta.ops.filter((o: any) => o.op !== 'resource.adjust');
      if (mutation === 'recipient') d.delta.ops[1].entity_id = entity(a.initial, 'npc', 'peg');
      if (mutation === 'endpoint') c.payload.endpoint_id = endpoint(a.initial, 'fen_return');
      if (mutation === 'quote') c.payload.quoted_fare = 0;
      if (mutation === 'move')
        d.delta.ops = d.delta.ops.filter((o: any) => o.op !== 'entity.transfer');
      if (mutation === 'entry') d.events = [];
      if (mutation === 'state')
        a.sql
          .prepare("UPDATE state_row SET value=? WHERE section='containers' AND key=?")
          .run(JSON.stringify(room(a.initial, 'boathouse')), a.initial.body);
      else
        a.sql
          .prepare('UPDATE receipt SET command=?,response=? WHERE invocation_id=?')
          .run(JSON.stringify(c), JSON.stringify(d), row.invocation_id);
      const before = disk(a);
      assert.equal(a.refuse().kind, 'save_corrupt', mutation);
      assert.deepEqual(disk(a), before, mutation);
    } finally {
      a.sql.close();
    }
  }
});
// Breaks: COMMIT uncertainty adopts a crossing/lesson early, permits input, loses a receipt, or retry moves/debits/grants twice.
test('real failed and uncertain COMMIT outcomes fence paid/free crossing and lesson then replay once', () => {
  for (const boundary of ['outbound', 'return', 'recovery', 'lesson'])
    for (const fault of ['known_failed', 'failed', 'lost'] as const) {
      const a = boundary === 'recovery' ? deathSetup() : setup();
      try {
        let i;
        if (boundary === 'recovery') {
          dieOnIsle(a);
          toRecoveryFerry(a);
          i = a.ferry();
        } else if (boundary === 'outbound') i = a.ferry();
        else {
          a.cross();
          i = boundary === 'return' ? a.ferry('fen_return') : lesson(a);
        }
        const prior = a.story.world(),
          before = disk(a),
          old = truth(a);
        a.sql.exec(
          'PRAGMA foreign_keys=ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
        );
        a.fault.kind = fault === 'known_failed' ? 'failed' : fault;
        a.fault.armed = true;
        if (fault === 'known_failed') {
          const exec = a.db.execSync;
          a.db.execSync = (operation) => {
            try {
              exec(operation);
            } catch (error) {
              a.fault.reads = false;
              throw error;
            }
          };
          assert.throws(() => a.story.invoke(i), /COMMIT failed; nothing was saved/);
        } else assert.equal(a.story.invoke(i).kind, 'pending');
        assert.equal(a.story.world(), prior);
        if (fault !== 'known_failed') {
          assert.equal(a.story.invoke(a.ferry()).kind, 'pending');
          assert.equal(
            a.story.elapsed({ expected_run_id: a.story.runId(), from: 0, until: 1 }).kind,
            'pending',
          );
        }
        a.fault.reads = false;
        if (a.sql.isTransaction) a.sql.exec('ROLLBACK');
        a.reopen();
        const next = {
          money: boundary === 'recovery' ? [0, 2] : [1, 2],
          place: room(
            a.initial,
            boundary === 'return'
              ? 'boathouse'
              : boundary === 'lesson'
                ? 'isle_hut'
                : 'fen_isle_landing',
          ),
          swim: boundary === 'lesson' || boundary === 'recovery',
        };
        assert.deepEqual(truth(a), fault === 'lost' ? next : old);
        if (fault !== 'lost') assert.deepEqual(disk(a), before);
        const retry = a.story.invoke(i);
        assert.equal(retry.kind === 'saved' && retry.replay, fault === 'lost');
        a.reopen();
        assert.deepEqual(truth(a), next);
        const saved = disk(a);
        a.story.invoke(i);
        assert.deepEqual(disk(a), saved);
      } finally {
        a.sql.close();
      }
    }
});
// Breaks: Book loses the endpoint's captured base quote, sends another action, narrates twice or keeps the boarding detail after arrival.
test('Book projects an exact boarding control and restores one committed endpoint result', (t) => {
  const a = setup();
  t.after(() => a.sql.close());
  const book = presenter(a.game);
  a.game.subscribe(book.update);
  const before = book.screen(),
    b = before.buttons.find((b) => b.action_key === 'board_ferry')!,
    id = endpoint(a.initial, 'fen_outbound');
  assert.deepEqual(intentOf(b).target_ids, [id]);
  assert.deepEqual(JSON.parse(JSON.stringify(intentOf(b).input)), {
    route: ref('transport', 'fen_outbound'),
    quoted_fare: 2,
  });
  assert.equal(
    group(before.buttons).place.some((b) => b.command === 'use_transport'),
    false,
  );
  book.press(b, id);
  book.press(b, id);
  const after = book.screen();
  assert.equal(after.view.place.id, room(a.initial, 'fen_isle_landing'));
  assert.deepEqual(pagesAfter([{ kind: 'notice', id }], before.view, after.view), []);
  const line = 'You draw the rope ferry across the fen and step onto Fen Isle Landing.';
  assert.equal(after.detail(id).filter((x) => x === line).length, 1);
  assert.deepEqual(presenter(a.game).screen().detail(id), [line]);
});

// Breaks: the valid bound Wren is omitted from ferry custody, or a crossing falsely completes Q2.
test('the original following Wren crosses once without rescue credit; separated Wren stays behind', (t) => {
  const a = deathSetup();
  t.after(() => a.sql.close());
  const torch = entity(a.initial, 'item', 'torch'),
    bag = entity(a.initial, 'item', 'satchel');
  a.invoke('seek_wisp');
  a.invoke('take', {}, [bag]);
  a.invoke('take', {}, [torch]);
  a.invoke('ignite', {}, [torch]);
  const move = (...ds: string[]) => ds.forEach((direction) => a.invoke('move', { direction }));
  const talk = (name: string) => a.invoke('talk', {}, [entity(a.initial, 'npc', name)]);
  const choose = (choice_id: string, answer?: string) =>
    a.invoke('choose', {
      choice_id,
      continuation_id: gameView(a.story.world()).choice!.continuation_id,
      ...(answer ? { answer } : {}),
    });
  move('east');
  talk('elspeth');
  choose('accept');
  move('north', 'north');
  a.invoke('take', {}, [entity(a.initial, 'item', 'fox_drawing')]);
  move('south', 'south');
  talk('elspeth');
  choose('report');
  move('south', 'south');
  a.invoke('study_tracks');
  move('south', 'south');
  talk('vesper');
  choose('meet_wren');
  talk('vesper');
  choose('answer', 'lantern');
  talk('wren');
  choose('rescue');
  move('north', 'north', 'north', 'north', 'west');
  a.reopen();
  a.cross();
  a.reopen();
  const w = a.story.world(),
    wren = entity(a.initial, 'npc', 'wren');
  assert.deepEqual(
    [w.state.containers[w.body], w.state.containers[wren]],
    [room(w, 'fen_isle_landing'), room(w, 'fen_isle_landing')],
  );
  assert.deepEqual(pennies(w), [0, 2]);
  assert.equal(
    Object.values(w.state.quests!).find((q) => q.quest.key === 'missing_child')!.state,
    'active',
  );
  assert.equal(w.state.escorts![w.character].status, 'following');
  move('east', 'up');
  a.invoke('put', {}, [torch, bag]);
  a.invoke('attack', {}, [entity(a.initial, 'npc', 'loft_test_rat')]);
  const due = Object.values(a.story.world().state.jobs!).find(
    (j) => j.status === 'pending' && j.encounter_id,
  )!.due_time;
  const fatal = a.story.elapsed({ expected_run_id: a.story.runId(), from: 0, until: due });
  assert.equal(fatal.kind === 'saved' && (fatal.decision as any).kind, 'accepted');
  a.reopen();
  assert.equal(a.story.world().state.escorts![w.character].status, 'separated');
  toRecoveryFerry(a);
  a.cross();
  a.reopen();
  assert.equal(a.story.world().state.containers[wren], room(w, 'hut_loft'));
  assert.equal(a.story.world().state.escorts![w.character].status, 'separated');
});

function deathSetup(path = ':memory:') {
  return setup(path, (c) => {
    c.resources[`${prefix}:resource/pennies`].start = 2;
    c.resources[`${prefix}:resource/hp`].start = 1;
    c.resources[`${prefix}:resource/hp`].gain = 0;
    for (const name of ['torch', 'satchel'])
      c.items[`${prefix}:item/${name}`].location = { in: 'room', room: ref('room', 'boathouse') };
    c.npcs[`${prefix}:npc/peg`].shop.offers = c.npcs[`${prefix}:npc/peg`].shop.offers.filter(
      (o: any) => !['torch', 'satchel'].includes(o.item.key),
    );
    const rat = structuredClone(c.npcs[`${prefix}:npc/cellar_rat_1`]);
    rat.key = 'loft_test_rat';
    rat.room = ref('room', 'hut_loft');
    rat.attack.chance = 100;
    rat.perception = { discovered: ref('fact', 'fen_wisp_discovered') };
    c.rooms[`${prefix}:room/boathouse`].details.glow = structuredClone(
      c.rooms[`${prefix}:room/marsh_light`].details.glow,
    );
    c.recipes[`${prefix}:recipe/seek_wisp`].target.room = ref('room', 'boathouse');
    c.npcs[`${prefix}:npc/loft_test_rat`] = rat;
    c.world.combat.player_attack.chance = 0;
  });
}
function dieOnIsle(a: ReturnType<typeof setup>) {
  const torch = entity(a.initial, 'item', 'torch'),
    bag = entity(a.initial, 'item', 'satchel');
  a.invoke('seek_wisp');
  a.invoke('take', {}, [bag]);
  a.invoke('take', {}, [torch]);
  a.invoke('ignite', {}, [torch]);
  a.cross();
  const learn = lesson(a);
  const taught = a.story.invoke(learn);
  assert.equal(taught.kind === 'saved' && (taught.decision as any).kind, 'accepted');
  a.invoke('move', { direction: 'up' });
  a.invoke('put', {}, [torch, bag]);
  a.invoke('attack', {}, [entity(a.initial, 'npc', 'loft_test_rat')]);
  const due = Object.values(a.story.world().state.jobs!).find(
    (j) => j.status === 'pending' && j.encounter_id,
  )!.due_time;
  const r = a.story.elapsed({ expected_run_id: a.story.runId(), from: 0, until: due });
  assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted', JSON.stringify(r));
  const w = a.story.world(),
    corpse = Object.entries(w.state.created!).find(
      ([, r]) => r.origin.kind === 'death' && r.origin.owner_id === w.character,
    )![0];
  assert.equal(w.state.containers[w.body], room(w, 'chapel_nave'));
  assert.equal(w.state.containers[corpse], room(w, 'hut_loft'));
  assert.equal(w.state.containers[bag], corpse);
  assert.equal(w.state.containers[torch], bag);
  assert.equal(w.state.fuel![torch].lit, true);
  assert.deepEqual(pennies(w), [0, 2]);
  return { corpse, torch, bag };
}
const toRecoveryFerry = (a: ReturnType<typeof setup>) =>
  ['south', 'south', 'south', 'south', 'south', 'west'].forEach((direction) =>
    a.invoke('move', { direction }),
  );
// Breaks: Chapel death return strands a penniless actor or dark-loft nested light, or recovery invalidates its earlier waived receipt.
test('actual Chapel death return reaches the dark-loft corpse without gear and retains every nested identity on cold reopen', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-transport-recovery-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const a = deathSetup(join(dir, 'save.db'));
  t.after(() => a.sql.close());
  const { corpse, torch, bag } = dieOnIsle(a);
  a.reopen();
  assert.deepEqual(gameView(a.story.world()).inventory, []);
  toRecoveryFerry(a);
  a.reopen();
  a.invoke('rest');
  a.reopen();
  const resting = gameView(a.story.world()).notices!.find((n) => n.transport)!.transport!;
  assert.deepEqual([resting.charge, resting.waived, resting.action.available], [0, true, false]);
  a.invoke('stand');
  const offer = gameView(a.story.world()).notices!.find((n) => n.transport)!.transport!;
  assert.deepEqual([offer.fare, offer.charge, offer.waived], [2, 0, true]);
  a.cross();
  a.reopen();
  a.invoke('move', { direction: 'east' });
  a.invoke('move', { direction: 'up' });
  a.reopen();
  const v = gameView(a.story.world());
  assert.equal(v.exits[0].direction, 'down');
  const body = v.entities.find((e) => e.id === corpse)!;
  assert.ok(body);
  assert.equal(body.contents!.find((e) => e.id === bag)!.container_id, corpse);
  assert.equal(body.contents!.find((e) => e.id === torch)!.container_id, bag);
  a.invoke('take', {}, [torch]);
  a.reopen();
  a.invoke('take', {}, [bag]);
  a.reopen();
  const w = a.story.world();
  assert.equal(w.state.containers[torch], w.body);
  assert.equal(w.state.containers[bag], w.body);
  assert.equal(w.state.containers[corpse], room(w, 'hut_loft'));
  assert.deepEqual(pennies(w), [0, 2]);
  a.invoke('move', { direction: 'down' });
  a.invoke('move', { direction: 'west' });
  a.cross('fen_return');
  a.reopen();
  assert.deepEqual(pennies(a.story.world()), [0, 2]);
});

// Breaks: transport-only saves skip accepted-history validation because no liquid, service, patrol, exchange or fuel producer activates it.
test('a transport-only cartridge validates crossing receipts without another producer', (t) => {
  const a = setup(':memory:', (c) => {
    delete c.services;
    delete c.liquids;
    delete c.populations;
    delete c.population_bundles;
    delete c.items[`${prefix}:item/hound_pelt`];
    delete c.items[`${prefix}:item/hound_corpse`];
    delete c.items[`${prefix}:item/deer_hide`];
    delete c.items[`${prefix}:item/deer_corpse`];
    c.scenes = Object.fromEntries(
      Object.entries(c.scenes).filter(([, scene]: any) => !scene.on?.rest),
    );
    for (const [key, npc] of Object.entries(c.npcs) as [string, any][])
      if (npc.spawn_template) delete c.npcs[key];
    for (const npc of Object.values(c.npcs) as any[]) delete npc.services;
    for (const item of Object.values(c.items) as any[]) {
      delete item.vessel;
      delete item.fuel;
    }
    for (const room of Object.values(c.rooms) as any[])
      for (const detail of Object.values(room.details ?? {}) as any[]) delete detail.liquid_source;
    for (const quest of Object.values(c.quests) as any[]) {
      if (quest.patrol)
        quest.objective = {
          evidence: 'current_state',
          policy: { policy_version: 1, root: { op: 'all', items: [] } },
        };
      delete quest.patrol;
      delete quest.exchange;
      delete quest.repeatable;
    }
    for (const dialogue of Object.values(c.dialogues) as any[])
      for (const choice of Object.values(dialogue.choices) as any[]) {
        delete choice.patrol;
        delete choice.exchange;
      }
  });
  t.after(() => a.sql.close());
  a.cross();
  a.reopen();
  assert.deepEqual(pennies(a.story.world()), [1, 2]);
  const row = a.sql
    .prepare(
      "SELECT invocation_id,response FROM receipt WHERE json_extract(command,'$.payload.type')='use_transport'",
    )
    .get()!;
  const decision = JSON.parse(row.response as string);
  decision.events = [];
  a.sql
    .prepare('UPDATE receipt SET response=? WHERE invocation_id=?')
    .run(JSON.stringify(decision), row.invocation_id);
  const before = disk(a);
  assert.equal(a.refuse().kind, 'save_corrupt');
  assert.deepEqual(disk(a), before);
});
